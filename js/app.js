/* js/app.js - VERSION SÉCURISÉE (LOGIN + FORGOT PASSWORD) */

import { app, auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js'; 
import * as DB from './db_manager.js';
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const safeHref = (value) => {
    const s = String(value ?? "").trim();
    if (!s) return "#";
    if (s.startsWith("blob:") || s.startsWith("data:") || s.startsWith("https://") || s.startsWith("http://")) return s;
    return "#";
};
const MAX_GED_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const storage = app ? getStorage(app) : getStorage();

/** Type MIME envoyé au Storage (obligatoire pour que les règles acceptent l'upload). */
function gedMimetypeForRules(file) {
    const t = (file && file.type ? String(file.type) : "").trim().toLowerCase();
    if (t.startsWith("image/") || t === "application/pdf") return t;
    const n = (file && file.name ? file.name : "").toLowerCase();
    if (n.endsWith(".pdf")) return "application/pdf";
    if (n.endsWith(".png")) return "image/png";
    if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
    if (n.endsWith(".webp")) return "image/webp";
    if (n.endsWith(".gif")) return "image/gif";
    if (n.endsWith(".bmp")) return "image/bmp";
    if (n.endsWith(".tif") || n.endsWith(".tiff")) return "image/tiff";
    if (n.endsWith(".heic") || n.endsWith(".heif")) return "image/heic";
    return "";
}
const pendingGedFiles = new Map();
const COMPACT_STORAGE_KEY = "pf_ui_compact";

function updateCompactToggleLabel() {
    const btn = document.getElementById('btn-compact-toggle');
    if (!btn) return;
    const isCompact = document.body.classList.contains('compact');
    btn.innerHTML = isCompact
        ? '<i class="fas fa-compress-alt"></i> Mode: Compact'
        : '<i class="fas fa-expand-alt"></i> Mode: Normal';
    btn.setAttribute('aria-pressed', isCompact ? 'true' : 'false');
}

window.toggleCompactMode = function() {
    document.body.classList.toggle('compact');
    const isCompact = document.body.classList.contains('compact');
    try { localStorage.setItem(COMPACT_STORAGE_KEY, isCompact ? "1" : "0"); } catch (_) {}
    updateCompactToggleLabel();
};

function formatFirebaseError(err) {
    const code = err?.code || "inconnu";
    const msg = err?.message || "Erreur non détaillée.";
    if (code.includes("permission-denied")) {
        return `Permission refusée (${code}). Vérifiez les règles Firestore/Storage et votre session utilisateur.\n\nDétail: ${msg}`;
    }
    if (code.includes("unauthenticated")) {
        return `Session expirée (${code}). Reconnectez-vous puis réessayez.\n\nDétail: ${msg}`;
    }
    if (code.includes("storage/unauthorized")) {
        return `Upload refusé (${code}). Vérifiez les règles Firebase Storage.\n\nDétail: ${msg}`;
    }
    if (code.includes("storage/canceled")) {
        return `Upload annulé (${code}).\n\nDétail: ${msg}`;
    }
    if (code.includes("storage/retry-limit-exceeded")) {
        return `Réseau instable (${code}). Réessayez avec une connexion plus stable.\n\nDétail: ${msg}`;
    }
    return `Erreur Firebase (${code}).\n\nDétail: ${msg}`;
}

// ============================================================
// 1. SÉCURITÉ & AUTHENTIFICATION
// ============================================================

window.loginFirebase = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');
    if(!email || !pass) { alert("Veuillez remplir tous les champs."); return; }
    try {
        btn.innerText = "Connexion...";
        await signInWithEmailAndPassword(auth, email, pass);
    } catch(e) { 
        console.error(e);
        btn.innerText = "SE CONNECTER";
        if(e.code === 'auth/invalid-credential') alert("Email ou mot de passe incorrect.");
        else alert("Erreur connexion : " + e.message); 
    }
};

window.motDePasseOublie = async function() {
    const email = document.getElementById('login-email').value;
    if (!email) { alert("Veuillez d'abord entrer votre EMAIL dans la case au-dessus."); return; }
    if(confirm(`Envoyer un email de réinitialisation à : ${email} ?`)) {
        try { await sendPasswordResetEmail(auth, email); alert("📧 Email envoyé !"); } catch(e) { alert("Erreur : " + e.message); }
    }
};

window.logoutFirebase = async function() { 
    if(confirm("Se déconnecter ?")) { await signOut(auth); window.location.reload(); }
};

onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('app-loader'); 
    if(loader) loader.style.display = 'none';

    if (user) {
        document.getElementById('login-screen')?.classList.add('hidden');
        Utils.chargerLogoBase64();
        DB.chargerBaseClients();
        setInterval(() => {
            const now = new Date();
            if(document.getElementById('header-time')) document.getElementById('header-time').innerText = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            if(document.getElementById('header-date')) document.getElementById('header-date').innerText = now.toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        }, 1000);
        setTimeout(() => { if(window.toggleSections) window.toggleSections(); }, 500);
    } else {
        document.getElementById('login-screen')?.classList.remove('hidden');
        document.getElementById('clients-table-body').innerHTML = "";
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const btnLogin = document.getElementById('btn-login');
    const btnForgot = document.getElementById('btn-forgot');
    if(btnLogin) btnLogin.onclick = window.loginFirebase;
    if(btnForgot) btnForgot.onclick = window.motDePasseOublie;
    document.getElementById('login-password')?.addEventListener('keypress', function (e) { if (e.key === 'Enter') window.loginFirebase(); });
    
    // Recherche dynamique (Base Clients) : filtre au fur et à mesure de la saisie
    const searchClient = document.getElementById('search-client');
    if (searchClient) {
        searchClient.addEventListener('input', () => {
            if (window.filtrerBaseClients) window.filtrerBaseClients();
        });
        searchClient.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (window.filtrerBaseClients) window.filtrerBaseClients();
            }
        });
    }

    try {
        const savedCompact = localStorage.getItem(COMPACT_STORAGE_KEY);
        if (savedCompact === "1") document.body.classList.add('compact');
        if (savedCompact === "0") document.body.classList.remove('compact');
    } catch (_) {}
    updateCompactToggleLabel();
});

// ============================================================
// 2. BRANCHEMENT DES FONCTIONS
// ============================================================

window.chargerBaseClients = DB.chargerBaseClients;
window.filtrerBaseClients = DB.filtrerBaseClients;
window.chargerDossiersAdminList = DB.chargerDossiersAdminList;
window.filtrerDossiersAdmin = DB.filtrerDossiersAdmin;
window.supprimerDossier = DB.supprimerDossier;
window.nouveauDossier = function() {
    window.currentDossierId = null;
    DB.viderFormulaire();
    window.showSection('admin');
};
window.viderFormulaire = function() {
    window.currentDossierId = null;
    DB.viderFormulaire();
};
window.chargerStock = DB.chargerStock;
window.ajouterArticleStock = DB.ajouterArticle;
window.supprimerArticle = DB.supprimerArticle;
window.importerClientSelectionne = DB.importerClientSelectionne;
window.chargerSelectImport = DB.chargerSelectImport;

if (PDF && PDF.genererPouvoir) {
    window.genererPouvoir = PDF.genererPouvoir;
    window.genererDeclaration = PDF.genererDeclaration;
    window.genererFermeture = PDF.genererFermeture;
    window.genererDemandeFermetureMairie = PDF.genererDemandeFermetureMairie;
    window.genererTransport = PDF.genererTransport;
    window.genererDemandeInhumation = PDF.genererDemandeInhumation;
    window.genererDemandeCremation = PDF.genererDemandeCremation;
    window.genererDemandeRapatriement = PDF.genererDemandeRapatriement;
    window.genererAttestationConformiteCercueil = PDF.genererAttestationConformiteCercueil;
    window.genererDemandeOuverture = PDF.genererDemandeOuverture;
    window.genererConfirmationCremation = PDF.genererConfirmationCremation;
    window.genererAttestationPresence = PDF.genererAttestationPresence;
    window.genererDeroulement = PDF.genererDeroulement;
}

// ============================================================
// 3. UI & PLANNING
// ============================================================

// --- NOUVEAU : GESTION DATE NAISSANCE INCOMPLÈTE ---
window.toggleDateNaiss = function() {
    const chk = document.getElementById('chk_sans_jour_mois');
    const inputDate = document.getElementById('date_naiss');
    const inputAnnee = document.getElementById('annee_naiss');
    if(chk && chk.checked) {
        inputDate.classList.add('hidden');
        inputAnnee.classList.remove('hidden');
    } else {
        inputDate.classList.remove('hidden');
        inputAnnee.classList.add('hidden');
    }
};

window.toggleSections = function() {
    const select = document.getElementById('prestation'); if(!select) return;
    const choix = select.value;
    const map = { 'Inhumation': 'bloc_inhumation', 'Crémation': 'bloc_cremation', 'Rapatriement': 'bloc_rapatriement' };
    
    ['bloc_inhumation', 'bloc_cremation', 'bloc_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    ['btn_inhumation', 'btn_cremation', 'btn_rapatriement', 'btn_conf_cremation', 'btn_attestation_cercueil'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    
    if (map[choix]) {
        document.getElementById(map[choix])?.classList.remove('hidden');
        document.getElementById('btn_'+choix.toLowerCase().replace('é','e'))?.classList.remove('hidden');
        if(choix === 'Crémation') document.getElementById('btn_conf_cremation')?.classList.remove('hidden');
        if(choix === 'Rapatriement') document.getElementById('btn_attestation_cercueil')?.classList.remove('hidden');
    }

    const itemsCremation = document.querySelectorAll('.cremation-only');
    itemsCremation.forEach(el => {
        if(choix === 'Crémation') el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
};

window.toggleVol2 = function() { const chk = document.getElementById('check_vol2'); const bloc = document.getElementById('bloc_vol2'); if(chk && bloc) { chk.checked ? bloc.classList.remove('hidden') : bloc.classList.add('hidden'); } };
window.togglePolice = function() { const select = document.getElementById('type_presence_select'); const bP = document.getElementById('police_fields'); const bF = document.getElementById('famille_fields'); if(!select) return; if(select.value === 'police') { bP.classList.remove('hidden'); bF.classList.add('hidden'); } else { bP.classList.add('hidden'); bF.classList.remove('hidden'); } };
window.copierMandant = function() { const chk = document.getElementById('copy_mandant'); if(chk && chk.checked) { document.getElementById('f_nom_prenom').value = document.getElementById('soussigne').value; document.getElementById('f_lien').value = document.getElementById('lien').value; } };
window.showSection = function(id) { document.querySelectorAll('.main-content > div').forEach(div => { if(div.id.startsWith('view-')) div.classList.add('hidden'); }); const target = document.getElementById('view-' + id); if(target) target.classList.remove('hidden'); if(id === 'base') DB.chargerBaseClients(); if(id === 'stock') DB.chargerStock(); if(id === 'admin') { DB.chargerSelectImport(); DB.chargerDossiersAdminList(); } };
window.switchAdminTab = function(tabName) {
    ['identite', 'technique', 'protocole'].forEach((name) => {
        document.getElementById('tab-content-' + name)?.classList.add('hidden');
        document.getElementById('tab-btn-' + name)?.classList.remove('active');
    });
    document.getElementById('tab-content-' + tabName)?.classList.remove('hidden');
    document.getElementById('tab-btn-' + tabName)?.classList.add('active');
};
window.toggleSidebar = function() { const sb = document.querySelector('.sidebar'); if(sb) sb.classList.toggle('collapsed'); };

// GESTION PLANNING DYNAMIQUE
window.ajouterLignePlanning = function(heure="", desc="") {
    const container = document.getElementById('container_planning');
    const div = document.createElement('div');
    div.className = "planning-row";
    div.style = "display:flex; gap:5px; margin-bottom:5px;";
    div.innerHTML = `
        <input type="time" class="pl-heure" value="${escapeHtml(heure)}" style="width:110px;">
        <input type="text" class="pl-desc" value="${escapeHtml(desc)}" placeholder="Description étape (ex: Mise en bière)" list="etapes_list" style="flex:1;">
        <button class="btn btn-red" onclick="this.parentElement.remove()" style="padding:5px 10px;">X</button>
    `;
    container.appendChild(div);
};

window.ajouterPieceJointe = function() {
    const container = document.getElementById('liste_pieces_jointes');
    const fileInput = document.getElementById('ged_input_file');
    const nameInput = document.getElementById('ged_file_name');
    if (fileInput.files.length === 0) { alert("⚠️ Sélectionnez un fichier."); return; }
    const file = fileInput.files[0];
    if (file.size > MAX_GED_FILE_SIZE) { alert("⚠️ FICHIER TROP LOURD (>10 Mo)."); return; }
    if (!gedMimetypeForRules(file)) {
        alert("⚠️ Format non pris en charge pour la GED. Utilisez un PDF ou une image (JPG, PNG, etc.).");
        return;
    }
    const nomDoc = nameInput.value || file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64String = e.target.result; const localUrl = URL.createObjectURL(file);
        if(container.innerText.includes('Aucun')) container.innerHTML = "";
        const div = document.createElement('div'); div.className = "ged-item"; 
        const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        div.style = "display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:8px;";
        div.setAttribute('data-name', nomDoc); div.setAttribute('data-b64', base64String); div.setAttribute('data-status', 'new'); div.setAttribute('data-temp-id', tempId);
        pendingGedFiles.set(tempId, file);
        div.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><i class="fas fa-file-pdf" style="color:#ef4444; font-size:1.6rem;"></i><div style="display:flex; flex-direction:column;"><span style="font-weight:700; color:#334155; font-size:0.95rem;">${escapeHtml(nomDoc)}</span><span style="font-size:0.75rem; color:#f59e0b; font-weight:bold;">À sauvegarder...</span></div></div><div style="display:flex; gap:8px;"><a href="${safeHref(localUrl)}" target="_blank" class="btn-icon" style="background:#3b82f6; color:white; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px;"><i class="fas fa-eye"></i></a><button onclick="this.closest('.ged-item').remove()" class="btn-icon" style="background:#ef4444; color:white; width:34px; height:34px; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-trash"></i></button></div>`;
        container.appendChild(div); fileInput.value = ""; nameInput.value = "";
    };
    reader.readAsDataURL(file);
};

window.sauvegarderDossier = async function() {
    const btn = document.getElementById('btn-save-bdd');
    if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
    try {
        const hiddenId = (document.getElementById('dossier_id')?.value || "").trim();
        const idDossier = (window.currentDossierId || hiddenId || "").trim();
        const getVal = (id) => document.getElementById(id)?.value || "";
        const getChk = (id) => document.getElementById(id)?.checked || false;

        let planningData = [];
        document.querySelectorAll('#container_planning .planning-row').forEach(row => {
            planningData.push({ heure: row.querySelector('.pl-heure').value, desc: row.querySelector('.pl-desc').value });
        });

        let data = {
            date_modification: new Date().toISOString(),
            defunt: { 
                civility: getVal('civilite_defunt'), nom: getVal('nom'), prenom: getVal('prenom'), nom_jeune_fille: getVal('nom_jeune_fille'), 
                date_deces: getVal('date_deces'), lieu_deces: getVal('lieu_deces'), heure_deces: getVal('heure_deces'), 
                date_naiss: getVal('date_naiss'), annee_naiss: getVal('annee_naiss'), sans_jour_mois: getChk('chk_sans_jour_mois'), // <-- NOUVEAU
                lieu_naiss: getVal('lieu_naiss'), nationalite: getVal('nationalite'),
                adresse: getVal('adresse_fr'), pere: getVal('pere'), mere: getVal('mere'), situation: getVal('matrimoniale'), conjoint: getVal('conjoint'), profession: getVal('profession_libelle') 
            },
            mandant: { civility: getVal('civilite_mandant'), nom: getVal('soussigne'), lien: getVal('lien'), telephone: getVal('tel_mandant'), adresse: getVal('demeurant') },
            technique: { type_operation: document.getElementById('prestation').value, lieu_mise_biere: getVal('lieu_mise_biere'), date_fermeture: getVal('date_fermeture'), cimetiere: getVal('cimetiere_nom'), crematorium: getVal('crematorium_nom'), date_ceremonie: getVal('date_inhumation') || getVal('date_cremation'), heure_ceremonie: getVal('heure_inhumation') || getVal('heure_cremation'), num_concession: getVal('num_concession'), faita: getVal('faita'), date_signature: getVal('dateSignature'), police_nom: getVal('p_nom_grade'), police_commissariat: getVal('p_commissariat') },
            transport: { av_dep: getVal('av_lieu_depart'), av_arr: getVal('av_lieu_arrivee'), av_date_dep: getVal('av_date_dep'), av_heure_dep: getVal('av_heure_dep'), av_date_arr: getVal('av_date_arr'), av_heure_arr: getVal('av_heure_arr'), ap_dep: getVal('ap_lieu_depart'), ap_arr: getVal('ap_lieu_arrivee'), ap_date_dep: getVal('ap_date_dep'), ap_heure_dep: getVal('ap_heure_dep'), ap_date_arr: getVal('ap_date_arr'), ap_heure_arr: getVal('ap_heure_arr'), rap_pays: getVal('rap_pays'), rap_ville: getVal('rap_ville'), rap_lta: getVal('rap_lta'), vol1_num: getVal('vol1_num'), vol1_dep_aero: getVal('vol1_dep_aero'), vol1_arr_aero: getVal('vol1_arr_aero'), vol1_dep_time: getVal('vol1_dep_time'), vol1_arr_time: getVal('vol1_arr_time'), vol2_num: getVal('vol2_num'), vol2_dep_aero: getVal('vol2_dep_aero'), vol2_arr_aero: getVal('vol2_arr_aero'), vol2_dep_time: getVal('vol2_dep_time'), vol2_arr_time: getVal('vol2_arr_time'), rap_immat: getVal('rap_immat'), rap_date_dep_route: getVal('rap_date_dep_route'), rap_ville_dep: getVal('rap_ville_dep'), rap_ville_arr: getVal('rap_ville_arr'), attest_trajet_depart: getVal('attest_trajet_depart'), attest_trajet_arrivee: getVal('attest_trajet_arrivee'), attest_cercueil_option: document.querySelector('input[name="attest_cercueil_option"]:checked')?.value || 'funisorb' },
            protocole: {
                cercueil: getVal('proto_cercueil'), urne: getVal('proto_urne'), salle_hommage: getChk('chk_salle_hommage'),
                maitre_ceremonie: getChk('chk_maitre_ceremonie'), civile: getChk('chk_civile'), religieuse: getChk('chk_religieuse'),
                recueillement: getChk('chk_recueil'), salon: getChk('chk_salon'), dispersion: getChk('chk_dispersion'),
                columbarium: getVal('proto_columbarium'), instructions: getVal('proto_instructions'), planning_dyn: planningData 
            }
        };
        let finalId = idDossier;
        if(idDossier) { await updateDoc(doc(db, "dossiers_admin", idDossier), data); } 
        else { data.date_creation = new Date().toISOString(); const docRef = await addDoc(collection(db, "dossiers_admin"), data); finalId = docRef.id; document.getElementById('dossier_id').value = finalId; }
        window.currentDossierId = finalId;

        const allGedItems = [];
        const elements = document.querySelectorAll('#liste_pieces_jointes .ged-item');
        for (const div of elements) {
            const name = div.getAttribute('data-name');
            const status = div.getAttribute('data-status');
            const b64 = div.getAttribute('data-b64');
            const tempId = div.getAttribute('data-temp-id');
            let storageId = div.getAttribute('data-storage-id');
            if (status === 'new') {
                try {
                    const fileToUpload = tempId ? pendingGedFiles.get(tempId) : null;
                    if (fileToUpload) {
                        const mime = gedMimetypeForRules(fileToUpload);
                        if (!mime) {
                            throw new Error("Format fichier GED non reconnu (PDF ou image requis).");
                        }
                        const safeName = name.replace(/[^\w.\-]/g, "_");
                        const path = `ged_files/${finalId}/${Date.now()}_${safeName}`;
                        const uploadedRef = ref(storage, path);
                        await uploadBytes(uploadedRef, fileToUpload, { contentType: mime });
                        const downloadURL = await getDownloadURL(uploadedRef);
                        const fileDoc = await addDoc(collection(db, "ged_files"), {
                            nom: name,
                            url: downloadURL,
                            storage_path: path,
                            dossier_parent: finalId,
                            date: new Date().toISOString()
                        });
                        storageId = fileDoc.id;
                    } else if (b64) {
                        // Fallback compatibilité si fichier temporaire introuvable.
                        const fileDoc = await addDoc(collection(db, "ged_files"), { nom: name, content: b64, dossier_parent: finalId, date: new Date().toISOString() });
                        storageId = fileDoc.id;
                    }
                    if (storageId) {
                        div.setAttribute('data-status', 'stored');
                        div.setAttribute('data-storage-id', storageId);
                        div.removeAttribute('data-b64');
                        if (tempId) pendingGedFiles.delete(tempId);
                    }
                } catch (err) {
                    console.error(err);
                    const docName = name || "Document sans nom";
                    alert(`⚠️ Échec upload GED: ${docName}\n\n${formatFirebaseError(err)}`);
                    throw err;
                }
            }
            if (storageId) allGedItems.push({ nom: name, ref_id: storageId });
            else if (status === 'stored' && !storageId && !b64) allGedItems.push(name);
        }
        await updateDoc(doc(db, "dossiers_admin", finalId), { ged: allGedItems });
        alert("✅ Sauvegarde réussie !");
        window.chargerDossier(finalId);
        if(window.chargerBaseClients) window.chargerBaseClients();
    } catch(e) {
        console.error(e);
        alert(`❌ Sauvegarde impossible.\n\n${formatFirebaseError(e)}`);
    }
    if(btn) btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
};

window.chargerDossier = async function(id) {
    try {
        const docRef = doc(db, "dossiers_admin", id); const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) { alert("❌ Dossier introuvable."); return; }
        const data = docSnap.data();
        const set = (htmlId, val) => { const el = document.getElementById(htmlId); if(el) el.value = val || ''; };
        const setChk = (htmlId, val) => { const el = document.getElementById(htmlId); if(el) el.checked = val || false; };

        if (data.defunt) { 
            set('civilite_defunt', data.defunt.civility); set('nom', data.defunt.nom); set('prenom', data.defunt.prenom); set('nom_jeune_fille', data.defunt.nom_jeune_fille); set('date_deces', data.defunt.date_deces); set('lieu_deces', data.defunt.lieu_deces); set('heure_deces', data.defunt.heure_deces); 
            // Chargement date naissance dynamique
            set('date_naiss', data.defunt.date_naiss); 
            set('annee_naiss', data.defunt.annee_naiss); 
            setChk('chk_sans_jour_mois', data.defunt.sans_jour_mois);
            if(window.toggleDateNaiss) window.toggleDateNaiss();

            set('lieu_naiss', data.defunt.lieu_naiss); set('nationalite', data.defunt.nationalite);
            set('adresse_fr', data.defunt.adresse); set('pere', data.defunt.pere); set('mere', data.defunt.mere); set('matrimoniale', data.defunt.situation); set('conjoint', data.defunt.conjoint); set('profession_libelle', data.defunt.profession); 
        }
        if (data.mandant) { set('civilite_mandant', data.mandant.civility); set('soussigne', data.mandant.nom); set('lien', data.mandant.lien); set('tel_mandant', data.mandant.telephone); set('demeurant', data.mandant.adresse); }
        if (data.technique) { const op = data.technique.type_operation || 'Inhumation'; set('prestation', op); set('lieu_mise_biere', data.technique.lieu_mise_biere); set('date_fermeture', data.technique.date_fermeture); set('cimetiere_nom', data.technique.cimetiere); set('crematorium_nom', data.technique.crematorium); set('num_concession', data.technique.num_concession); set('faita', data.technique.faita); set('dateSignature', data.technique.date_signature); set('p_nom_grade', data.technique.police_nom); set('p_commissariat', data.technique.police_commissariat); if (op === 'Inhumation') { set('date_inhumation', data.technique.date_ceremonie); set('heure_inhumation', data.technique.heure_ceremonie); } else if (op === 'Crémation') { set('date_cremation', data.technique.date_ceremonie); set('heure_cremation', data.technique.heure_ceremonie); } }
        if (data.transport) { set('av_lieu_depart', data.transport.av_dep); set('av_lieu_arrivee', data.transport.av_arr); set('av_date_dep', data.transport.av_date_dep); set('av_heure_dep', data.transport.av_heure_dep); set('av_date_arr', data.transport.av_date_arr); set('av_heure_arr', data.transport.av_heure_arr); set('ap_lieu_depart', data.transport.ap_dep); set('ap_lieu_arrivee', data.transport.ap_arr); set('ap_date_dep', data.transport.ap_date_dep); set('ap_heure_dep', data.transport.ap_heure_dep); set('ap_date_arr', data.transport.ap_date_arr); set('ap_heure_arr', data.transport.ap_heure_arr); set('rap_pays', data.transport.rap_pays); set('rap_ville', data.transport.rap_ville); set('rap_lta', data.transport.rap_lta); set('vol1_num', data.transport.vol1_num); set('vol1_dep_aero', data.transport.vol1_dep_aero); set('vol1_arr_aero', data.transport.vol1_arr_aero); set('vol1_dep_time', data.transport.vol1_dep_time); set('vol1_arr_time', data.transport.vol1_arr_time); set('vol2_num', data.transport.vol2_num); set('vol2_dep_aero', data.transport.vol2_dep_aero); set('vol2_arr_aero', data.transport.vol2_arr_aero); set('vol2_dep_time', data.transport.vol2_dep_time); set('vol2_arr_time', data.transport.vol2_arr_time); set('rap_immat', data.transport.rap_immat); set('rap_date_dep_route', data.transport.rap_date_dep_route); set('rap_ville_dep', data.transport.rap_ville_dep); set('rap_ville_arr', data.transport.rap_ville_arr); set('attest_trajet_depart', data.transport.attest_trajet_depart); set('attest_trajet_arrivee', data.transport.attest_trajet_arrivee); const aco = data.transport.attest_cercueil_option || 'funisorb'; document.querySelectorAll('input[name="attest_cercueil_option"]').forEach((r) => { r.checked = r.value === aco; }); }
        
        if (data.protocole) {
            set('proto_cercueil', data.protocole.cercueil); set('proto_urne', data.protocole.urne); setChk('chk_salle_hommage', data.protocole.salle_hommage); setChk('chk_maitre_ceremonie', data.protocole.maitre_ceremonie); setChk('chk_civile', data.protocole.civile); setChk('chk_religieuse', data.protocole.religieuse); setChk('chk_recueil', data.protocole.recueillement); setChk('chk_salon', data.protocole.salon); setChk('chk_dispersion', data.protocole.dispersion); set('proto_columbarium', data.protocole.columbarium); set('proto_instructions', data.protocole.instructions);
            const container = document.getElementById('container_planning'); container.innerHTML = ""; 
            if (data.protocole.planning_dyn && Array.isArray(data.protocole.planning_dyn)) {
                data.protocole.planning_dyn.forEach(row => { window.ajouterLignePlanning(row.heure, row.desc); });
            }
        }

        const container = document.getElementById('liste_pieces_jointes'); const rawGed = data.ged || data.pieces_jointes || [];
        if (container) {
            container.innerHTML = ""; 
            if (Array.isArray(rawGed) && rawGed.length > 0) {
                for (const item of rawGed) {
                    let nom = "", lien = "#", isBinary = false, storageId = null, statusLabel = "", statusColor = "#64748b";
                    if (item.ref_id) {
                        nom = item.nom; storageId = item.ref_id; isBinary = true; statusLabel = "En ligne ✅"; statusColor = "#10b981";
                        try {
                            const fileSnap = await getDoc(doc(db, "ged_files", item.ref_id));
                            if(fileSnap.exists()) {
                                const fileData = fileSnap.data();
                                if (fileData.url) {
                                    lien = fileData.url;
                                } else if (fileData.content) {
                                    const blob = await (await fetch(fileData.content)).blob();
                                    lien = URL.createObjectURL(blob);
                                }
                            }
                        } catch(e) {}
                    } else if (item.url) {
                        nom = item.nom || "Document";
                        isBinary = true;
                        lien = item.url;
                        statusLabel = "En ligne ✅";
                        statusColor = "#10b981";
                    } else if (item.file) { nom = item.nom; isBinary = true; statusLabel = "En ligne (V1) ✅"; statusColor = "#10b981"; try { lien = URL.createObjectURL(await (await fetch(item.file)).blob()); } catch(e) { lien = item.file; } } else { nom = item; statusLabel = "Ancien format"; }
                    if(typeof nom === 'string' && nom.includes("Enregistré")) continue;
                    const div = document.createElement('div'); div.className = "ged-item"; div.setAttribute('data-name', nom); div.setAttribute('data-status', 'stored'); if(storageId) div.setAttribute('data-storage-id', storageId);
                    div.style = "display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:8px;";
                    const btnEye = isBinary ? `<a href="${safeHref(lien)}" target="_blank" class="btn-icon" style="background:#3b82f6; color:white; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px;"><i class="fas fa-eye"></i></a>` : `<div style="background:#e2e8f0; color:#94a3b8; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px;"><i class="fas fa-eye-slash"></i></div>`;
                    div.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><i class="fas fa-file-pdf" style="color:#ef4444; font-size:1.6rem;"></i><div style="display:flex; flex-direction:column;"><span style="font-weight:700; color:#334155; font-size:0.95rem;">${escapeHtml(nom)}</span><span style="font-size:0.75rem; color:${statusColor}; font-weight:600;">${escapeHtml(statusLabel)}</span></div></div><div style="display:flex; gap:8px;">${btnEye}<button onclick="this.closest('.ged-item').remove()" class="btn-icon" style="background:#ef4444; color:white; width:34px; height:34px; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-trash"></i></button></div>`;
                    container.appendChild(div);
                }
            } else { container.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">Aucun document joint.</div>'; }
        }
        const hiddenId = document.getElementById('dossier_id'); if(hiddenId) hiddenId.value = id;
        window.currentDossierId = id;
        const btn = document.getElementById('btn-save-bdd'); if (btn) { btn.innerHTML = `<i class="fas fa-pen"></i> MODIFIER LE DOSSIER`; btn.classList.remove('btn-green'); btn.classList.add('btn-warning'); btn.style.backgroundColor = "#f59e0b"; btn.onclick = function() { window.sauvegarderDossier(); }; }
        if(window.toggleSections) window.toggleSections(); if(window.togglePolice) window.togglePolice(); if(window.toggleVol2) window.toggleVol2();
        window.showSection('admin');
    } catch (e) { console.error(e); alert("Erreur : " + e.message); }
};
