/* js/app.js - VERSION MASTER (CORRECTIF AFFICHAGE LOGIN + DÉCONNEXION) */

import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js'; 
import * as DB from './db_manager.js';

// ============================================================
// 1. SÉCURITÉ & AUTHENTIFICATION
// ============================================================

window.loginFirebase = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');
    
    if(!email || !pass) { alert("Veuillez remplir tous les champs."); return; }
    
    try {
        if(btn) btn.innerText = "Connexion...";
        await signInWithEmailAndPassword(auth, email, pass);
    } catch(e) { 
        console.error(e);
        if(btn) btn.innerText = "SE CONNECTER";
        if(e.code === 'auth/invalid-credential') alert("Email ou mot de passe incorrect.");
        else alert("Erreur connexion : " + e.message); 
    }
};

window.motDePasseOublie = async function() {
    const email = document.getElementById('login-email').value;
    if (!email) {
        alert("Veuillez d'abord entrer votre EMAIL dans la case au-dessus, puis recliquez sur ce lien.");
        return;
    }
    if(confirm(`Envoyer un email de réinitialisation à : ${email} ?`)) {
        try {
            await sendPasswordResetEmail(auth, email);
            alert("📧 Email envoyé ! Vérifiez votre boîte mail.");
        } catch(e) { alert("Erreur : " + e.message); }
    }
};

window.logoutFirebase = async function() { 
    if(confirm("Se déconnecter de l'application ?")) {
        await signOut(auth); 
        window.location.reload(); 
    }
};

// --- LE GARDIEN (Surveillance Connexion) ---
onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('app-loader'); 
    const loginScreen = document.getElementById('login-screen');
    
    if(loader) loader.style.display = 'none';

    if (user) {
        console.log("✅ Connecté : " + user.email);
        
        // --- CORRECTIF MAJEUR ICI ---
        // On force le style à 'none' pour surcharger le 'display:flex' du HTML
        if (loginScreen) {
            loginScreen.style.setProperty('display', 'none', 'important');
            loginScreen.classList.add('hidden');
        }

        Utils.chargerLogoBase64();
        DB.chargerBaseClients('init', true); 
        
        setInterval(() => {
            const now = new Date();
            const elTime = document.getElementById('header-time');
            const elDate = document.getElementById('header-date');
            if(elTime) elTime.innerText = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            if(elDate) elDate.innerText = now.toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        }, 1000);

        setTimeout(() => { if(window.toggleSections) window.toggleSections(); }, 500);

    } else {
        console.log("🔒 Non connecté");
        
        // On force l'affichage
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.classList.remove('hidden');
        }
        
        const tbody = document.getElementById('clients-table-body');
        if(tbody) tbody.innerHTML = "";
    }
});

// --- INIT BOUTONS (C'est ici que la déconnexion est activée) ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Connexion
    const btnLogin = document.getElementById('btn-login');
    if(btnLogin) btnLogin.onclick = window.loginFirebase;

    // 2. Mot de passe oublié
    const btnForgot = document.getElementById('btn-forgot');
    if(btnForgot) btnForgot.onclick = window.motDePasseOublie;

    // 3. DÉCONNEXION (Ajouté)
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) {
        btnLogout.onclick = function(e) {
            e.preventDefault(); // Empêche le lien de remonter en haut de page
            window.logoutFirebase();
        };
    }

    // 4. Touche Entrée
    const passInput = document.getElementById('login-password');
    if(passInput) {
        passInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') window.loginFirebase();
        });
    }
});

// ============================================================
// 2. INTERFACE & LOGIQUE MÉTIER
// ============================================================

window.chargerBaseClients = DB.chargerBaseClients;
window.filtrerBaseClients = DB.filtrerBaseClients;
window.supprimerDossier = DB.supprimerDossier;
window.viderFormulaire = DB.viderFormulaire;
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
    window.genererDemandeOuverture = PDF.genererDemandeOuverture;
}

window.showSection = function(id) { 
    document.querySelectorAll('.main-content > div').forEach(div => { 
        if(div.id.startsWith('view-')) div.classList.add('hidden'); 
    }); 
    const target = document.getElementById('view-' + id); 
    if(target) target.classList.remove('hidden'); 
    
    if(id === 'base') DB.chargerBaseClients('init', false); 
    if(id === 'stock') DB.chargerStock(); 
    if(id === 'admin') DB.chargerSelectImport(); 
};

// Fonctions UI
window.toggleSections = function() {
    const select = document.getElementById('prestation'); if(!select) return;
    const choix = select.value;
    ['bloc_inhumation', 'bloc_cremation', 'bloc_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    ['btn_inhumation', 'btn_cremation', 'btn_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    if (choix === 'Inhumation') { document.getElementById('bloc_inhumation')?.classList.remove('hidden'); document.getElementById('btn_inhumation')?.classList.remove('hidden'); }
    else if (choix === 'Crémation') { document.getElementById('bloc_cremation')?.classList.remove('hidden'); document.getElementById('btn_cremation')?.classList.remove('hidden'); }
    else if (choix === 'Rapatriement') { document.getElementById('bloc_rapatriement')?.classList.remove('hidden'); document.getElementById('btn_rapatriement')?.classList.remove('hidden'); }
};

window.toggleVol2 = function() { const chk = document.getElementById('check_vol2'); const bloc = document.getElementById('bloc_vol2'); if(chk && bloc) { chk.checked ? bloc.classList.remove('hidden') : bloc.classList.add('hidden'); } };

window.togglePolice = function() { 
    const select = document.getElementById('type_presence_select'); 
    const bP = document.getElementById('police_fields'); 
    const bF = document.getElementById('famille_fields'); 
    if(!select) return; 
    if(select.value === 'police') { bP.classList.remove('hidden'); bF.classList.add('hidden'); } 
    else { bP.classList.add('hidden'); bF.classList.remove('hidden'); } 
};

window.copierMandant = function() { 
    const chk = document.getElementById('copy_mandant'); 
    if(chk && chk.checked) { 
        document.getElementById('f_nom_prenom').value = document.getElementById('soussigne').value; 
        document.getElementById('f_lien').value = document.getElementById('lien').value; 
    } 
};

window.switchAdminTab = function(tabName) { 
    document.getElementById('tab-content-identite').classList.add('hidden'); 
    document.getElementById('tab-content-technique').classList.add('hidden'); 
    document.getElementById('tab-btn-identite').classList.remove('active'); 
    document.getElementById('tab-btn-technique').classList.remove('active'); 
    document.getElementById('tab-content-' + tabName).classList.remove('hidden'); 
    document.getElementById('tab-btn-' + tabName).classList.add('active'); 
};

window.toggleSidebar = function() { const sb = document.querySelector('.sidebar'); if(sb) sb.classList.toggle('collapsed'); };

// ============================================================
// 3. GED & SAUVEGARDE
// ============================================================
window.ajouterPieceJointe = function() {
    const container = document.getElementById('liste_pieces_jointes');
    const fileInput = document.getElementById('ged_input_file');
    const nameInput = document.getElementById('ged_file_name');

    if (fileInput.files.length === 0) { alert("⚠️ Sélectionnez un fichier."); return; }
    const file = fileInput.files[0];
    if (file.size > 1000 * 1024) { alert("⚠️ FICHIER TROP LOURD (>1 Mo)."); return; }

    const nomDoc = nameInput.value || file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64String = e.target.result;
        const localUrl = URL.createObjectURL(file);
        if(container.innerText.includes('Aucun')) container.innerHTML = "";
        const div = document.createElement('div');
        div.className = "ged-item"; 
        div.style = "display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:8px;";
        div.setAttribute('data-name', nomDoc);
        div.setAttribute('data-b64', base64String); 
        div.setAttribute('data-status', 'new'); 
        div.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><i class="fas fa-file-pdf" style="color:#ef4444; font-size:1.6rem;"></i><div style="display:flex; flex-direction:column;"><span style="font-weight:700; color:#334155; font-size:0.95rem;">${nomDoc}</span><span style="font-size:0.75rem; color:#f59e0b; font-weight:bold;">À sauvegarder...</span></div></div><div style="display:flex; gap:8px;"><a href="${localUrl}" target="_blank" class="btn-icon" style="background:#3b82f6; color:white; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px;"><i class="fas fa-eye"></i></a><button onclick="this.closest('.ged-item').remove()" class="btn-icon" style="background:#ef4444; color:white; width:34px; height:34px; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-trash"></i></button></div>`;
        container.appendChild(div);
        fileInput.value = ""; nameInput.value = "";
    };
    reader.readAsDataURL(file);
};

window.sauvegarderDossier = async function() {
    const btn = document.getElementById('btn-save-bdd');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...'; }
    try {
        const idDossier = document.getElementById('dossier_id').value;
        const getVal = (id) => document.getElementById(id)?.value || "";
        
        let data = {
            date_modification: new Date().toISOString(),
            defunt: { civility: getVal('civilite_defunt'), nom: getVal('nom'), prenom: getVal('prenom'), nom_jeune_fille: getVal('nom_jeune_fille'), date_deces: getVal('date_deces'), lieu_deces: getVal('lieu_deces'), heure_deces: getVal('heure_deces'), date_naiss: getVal('date_naiss'), lieu_naiss: getVal('lieu_naiss'), adresse: getVal('adresse_fr'), pere: getVal('pere'), mere: getVal('mere'), situation: getVal('matrimoniale'), conjoint: getVal('conjoint'), profession: getVal('profession_libelle') },
            mandant: { civility: getVal('civilite_mandant'), nom: getVal('soussigne'), lien: getVal('lien'), adresse: getVal('demeurant') },
            technique: { type_operation: document.getElementById('prestation').value, lieu_mise_biere: getVal('lieu_mise_biere'), date_fermeture: getVal('date_fermeture'), cimetiere: getVal('cimetiere_nom'), crematorium: getVal('crematorium_nom'), date_ceremonie: getVal('date_inhumation') || getVal('date_cremation'), heure_ceremonie: getVal('heure_inhumation') || getVal('heure_cremation'), num_concession: getVal('num_concession'), faita: getVal('faita'), date_signature: getVal('dateSignature'), police_nom: getVal('p_nom_grade'), police_commissariat: getVal('p_commissariat'), temoin_nom: getVal('f_nom_prenom'), temoin_lien: getVal('f_lien'), titulaire: getVal('titulaire_concession') },
            transport: { av_dep: getVal('av_lieu_depart'), av_arr: getVal('av_lieu_arrivee'), av_date_dep: getVal('av_date_dep'), av_heure_dep: getVal('av_heure_dep'), av_date_arr: getVal('av_date_arr'), av_heure_arr: getVal('av_heure_arr'), ap_dep: getVal('ap_lieu_depart'), ap_arr: getVal('ap_lieu_arrivee'), ap_date_dep: getVal('ap_date_dep'), ap_heure_dep: getVal('ap_heure_dep'), ap_date_arr: getVal('ap_date_arr'), ap_heure_arr: getVal('ap_heure_arr'), rap_pays: getVal('rap_pays'), rap_ville: getVal('rap_ville'), rap_lta: getVal('rap_lta'), vol1_num: getVal('vol1_num'), vol1_dep_aero: getVal('vol1_dep_aero'), vol1_arr_aero: getVal('vol1_arr_aero'), vol1_dep_time: getVal('vol1_dep_time'), vol1_arr_time: getVal('vol1_arr_time'), vol2_num: getVal('vol2_num'), vol2_dep_aero: getVal('vol2_dep_aero'), vol2_arr_aero: getVal('vol2_arr_aero'), vol2_dep_time: getVal('vol2_dep_time'), vol2_arr_time: getVal('vol2_arr_time'), rap_immat: getVal('rap_immat'), rap_date_dep_route: getVal('rap_date_dep_route'), rap_ville_dep: getVal('rap_ville_dep'), rap_ville_arr: getVal('rap_ville_arr') }
        };

        let finalId = idDossier;
        if(idDossier) { await updateDoc(doc(db, "dossiers_admin", idDossier), data); } 
        else { data.date_creation = new Date().toISOString(); const docRef = await addDoc(collection(db, "dossiers_admin"), data); finalId = docRef.id; document.getElementById('dossier_id').value = finalId; }
        
        const allGedItems = [];
        const elements = document.querySelectorAll('#liste_pieces_jointes .ged-item');
        for (const div of elements) {
            const name = div.getAttribute('data-name');
            const status = div.getAttribute('data-status');
            const b64 = div.getAttribute('data-b64');
            let storageId = div.getAttribute('data-storage-id');
            if (status === 'new' && b64) {
                try {
                    const fileDoc = await addDoc(collection(db, "ged_files"), { nom: name, content: b64, dossier_parent: finalId, date: new Date().toISOString() });
                    storageId = fileDoc.id;
                    div.setAttribute('data-status', 'stored'); div.setAttribute('data-storage-id', storageId);
                } catch (err) { console.error(err); continue; }
            }
            if (storageId) allGedItems.push({ nom: name, ref_id: storageId });
            else if (status === 'stored' && !storageId && !b64) allGedItems.push(name);
        }
        await updateDoc(doc(db, "dossiers_admin", finalId), { ged: allGedItems });
        
        DB.chargerBaseClients('init', true);
        alert("✅ Sauvegarde réussie !");
        window.chargerDossier(finalId);
    } catch(e) { console.error(e); alert("Erreur : " + e.message); }
    if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER'; }
};

window.chargerDossier = async function(id) {
    try {
        const docRef = doc(db, "dossiers_admin", id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) { alert("❌ Dossier introuvable."); return; }
        const data = docSnap.data();
        const set = (htmlId, val) => { const el = document.getElementById(htmlId); if(el) el.value = val || ''; };

        if (data.defunt) { set('civilite_defunt', data.defunt.civility); set('nom', data.defunt.nom); set('prenom', data.defunt.prenom); set('nom_jeune_fille', data.defunt.nom_jeune_fille); set('date_deces', data.defunt.date_deces); set('lieu_deces', data.defunt.lieu_deces); set('heure_deces', data.defunt.heure_deces); set('date_naiss', data.defunt.date_naiss); set('lieu_naiss', data.defunt.lieu_naiss); set('adresse_fr', data.defunt.adresse); set('pere', data.defunt.pere); set('mere', data.defunt.mere); set('matrimoniale', data.defunt.situation); set('conjoint', data.defunt.conjoint); set('profession_libelle', data.defunt.profession); }
        if (data.mandant) { set('civilite_mandant', data.mandant.civility); set('soussigne', data.mandant.nom); set('lien', data.mandant.lien); set('demeurant', data.mandant.adresse); }
        if (data.technique) { 
            const op = data.technique.type_operation || 'Inhumation'; 
            set('prestation', op); set('lieu_mise_biere', data.technique.lieu_mise_biere); set('date_fermeture', data.technique.date_fermeture); set('cimetiere_nom', data.technique.cimetiere); set('crematorium_nom', data.technique.crematorium); set('num_concession', data.technique.num_concession); set('faita', data.technique.faita); set('dateSignature', data.technique.date_signature); set('p_nom_grade', data.technique.police_nom); set('p_commissariat', data.technique.police_commissariat); 
            set('f_nom_prenom', data.technique.temoin_nom); set('f_lien', data.technique.temoin_lien); set('titulaire_concession', data.technique.titulaire);
            if (op === 'Inhumation') { set('date_inhumation', data.technique.date_ceremonie); set('heure_inhumation', data.technique.heure_ceremonie); } else if (op === 'Crémation') { set('date_cremation', data.technique.date_ceremonie); set('heure_cremation', data.technique.heure_ceremonie); } 
        }
        if (data.transport) { set('av_lieu_depart', data.transport.av_dep); set('av_lieu_arrivee', data.transport.av_arr); set('av_date_dep', data.transport.av_date_dep); set('av_heure_dep', data.transport.av_heure_dep); set('av_date_arr', data.transport.av_date_arr); set('av_heure_arr', data.transport.av_heure_arr); set('ap_lieu_depart', data.transport.ap_dep); set('ap_lieu_arrivee', data.transport.ap_arr); set('ap_date_dep', data.transport.ap_date_dep); set('ap_heure_dep', data.transport.ap_heure_dep); set('ap_date_arr', data.transport.ap_date_arr); set('ap_heure_arr', data.transport.ap_heure_arr); set('rap_pays', data.transport.rap_pays); set('rap_ville', data.transport.rap_ville); set('rap_lta', data.transport.rap_lta); set('vol1_num', data.transport.vol1_num); set('vol1_dep_aero', data.transport.vol1_dep_aero); set('vol1_arr_aero', data.transport.vol1_arr_aero); set('vol1_dep_time', data.transport.vol1_dep_time); set('vol1_arr_time', data.transport.vol1_arr_time); set('vol2_num', data.transport.vol2_num); set('vol2_dep_aero', data.transport.vol2_dep_aero); set('vol2_arr_aero', data.transport.vol2_arr_aero); set('vol2_dep_time', data.transport.vol2_dep_time); set('vol2_arr_time', data.transport.vol2_arr_time); set('rap_immat', data.transport.rap_immat); set('rap_date_dep_route', data.transport.rap_date_dep_route); set('rap_ville_dep', data.transport.rap_ville_dep); set('rap_ville_arr', data.transport.rap_ville_arr); }
        
        const container = document.getElementById('liste_pieces_jointes');
        const rawGed = data.ged || data.pieces_jointes || [];
        if (container) { 
            container.innerHTML = ""; 
            if (Array.isArray(rawGed) && rawGed.length > 0) {
                for (const item of rawGed) {
                    let nom = "", lien = "#", isBinary = false, storageId = null, statusLabel = "", statusColor = "#64748b";
                    if (item.ref_id) { nom = item.nom; storageId = item.ref_id; isBinary = true; statusLabel = "En ligne ✅"; statusColor = "#10b981"; try { const fileSnap = await getDoc(doc(db, "ged_files", item.ref_id)); if(fileSnap.exists()) { const blob = await (await fetch(fileSnap.data().content)).blob(); lien = URL.createObjectURL(blob); } } catch(e) {} } else if (item.file) { nom = item.nom; isBinary = true; statusLabel = "En ligne (V1) ✅"; statusColor = "#10b981"; try { lien = URL.createObjectURL(await (await fetch(item.file)).blob()); } catch(e) { lien = item.file; } } else { nom = item; statusLabel = "Ancien format"; }
                    if(typeof nom === 'string' && nom.includes("Enregistré")) continue;
                    const div = document.createElement('div'); div.className = "ged-item"; div.setAttribute('data-name', nom); div.setAttribute('data-status', 'stored'); if(storageId) div.setAttribute('data-storage-id', storageId); div.style = "display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:8px;";
                    const btnEye = isBinary ? `<a href="${lien}" target="_blank" class="btn-icon" style="background:#3b82f6; color:white; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px;"><i class="fas fa-eye"></i></a>` : `<div style="background:#e2e8f0; color:#94a3b8; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px;"><i class="fas fa-eye-slash"></i></div>`;
                    div.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><i class="fas fa-file-pdf" style="color:#ef4444; font-size:1.6rem;"></i><div style="display:flex; flex-direction:column;"><span style="font-weight:700; color:#334155; font-size:0.95rem;">${nom}</span><span style="font-size:0.75rem; color:${statusColor}; font-weight:600;">${statusLabel}</span></div></div><div style="display:flex; gap:8px;">${btnEye}<button onclick="this.closest('.ged-item').remove()" class="btn-icon" style="background:#ef4444; color:white; width:34px; height:34px; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-trash"></i></button></div>`;
                    container.appendChild(div);
                }
            } else { container.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">Aucun document joint.</div>'; }
        }
        const hiddenId = document.getElementById('dossier_id'); if(hiddenId) hiddenId.value = id;
        const btn = document.getElementById('btn-save-bdd');
        if (btn) { btn.innerHTML = `<i class="fas fa-pen"></i> MODIFIER LE DOSSIER`; btn.classList.remove('btn-green'); btn.classList.add('btn-warning'); btn.style.backgroundColor = "#f59e0b"; btn.onclick = function() { window.sauvegarderDossier(); }; }
        if(window.toggleSections) window.toggleSections(); if(window.togglePolice) window.togglePolice(); if(window.toggleVol2) window.toggleVol2(); window.showSection('admin');
    } catch (e) { console.error(e); alert("Erreur : " + e.message); }
};
