/* js/app.js - VERSION CORRIGÉE (PDF + SAUVEGARDE SÉCURISÉE) */

import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import { doc, getDoc, collection, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// ============================================================
// 1. REBRANCHEMENT DES FONCTIONS (C'est ici que ça manquait)
// ============================================================

// Base de données
window.chargerBaseClients = DB.chargerBaseClients;
window.supprimerDossier = DB.supprimerDossier;
window.viderFormulaire = DB.viderFormulaire;
window.chargerStock = DB.chargerStock;
window.ajouterArticleStock = DB.ajouterArticle;
window.supprimerArticle = DB.supprimerArticle;
window.importerClientSelectionne = DB.importerClientSelectionne;
window.chargerSelectImport = DB.chargerSelectImport;

// --- LES PDF (LISTE COMPLÈTE) ---
window.genererPouvoir = PDF.genererPouvoir;
window.genererDeclaration = PDF.genererDeclaration;
window.genererFermeture = PDF.genererFermeture; // PV Police
window.genererDemandeFermetureMairie = PDF.genererDemandeFermetureMairie;
window.genererTransport = PDF.genererTransport;
window.genererDemandeInhumation = PDF.genererDemandeInhumation;
window.genererDemandeCremation = PDF.genererDemandeCremation;
window.genererDemandeRapatriement = PDF.genererDemandeRapatriement;
window.genererDemandeOuverture = PDF.genererDemandeOuverture;


// ============================================================
// 2. AJOUT FICHIER (Ged)
// ============================================================
window.ajouterPieceJointe = function() {
    const container = document.getElementById('liste_pieces_jointes');
    const fileInput = document.getElementById('ged_input_file');
    const nameInput = document.getElementById('ged_file_name');

    if (fileInput.files.length === 0) { alert("⚠️ Sélectionnez un fichier."); return; }
    const file = fileInput.files[0];

    // Limite de 1 Mo (Google Firestore)
    if (file.size > 1000 * 1024) {
        alert("⚠️ FICHIER TROP LOURD (>1 Mo). Veuillez le compresser.");
        return;
    }

    const nomDoc = nameInput.value || file.name;
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const base64String = e.target.result;
        const localUrl = URL.createObjectURL(file);

        if(container.innerText.includes('Aucun')) container.innerHTML = "";

        const div = document.createElement('div');
        div.className = "ged-item"; 
        div.style = "display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
        
        // Données pour la sauvegarde
        div.setAttribute('data-name', nomDoc);
        div.setAttribute('data-b64', base64String); 
        div.setAttribute('data-status', 'new'); // Marqué "Nouveau"

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <i class="fas fa-file-pdf" style="color:#ef4444; font-size:1.6rem;"></i>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:700; color:#334155; font-size:0.95rem;">${nomDoc}</span>
                    <span style="font-size:0.75rem; color:#f59e0b; font-weight:bold;">En attente de sauvegarde...</span>
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <a href="${localUrl}" target="_blank" class="btn-icon" style="background:#3b82f6; color:white; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px; text-decoration:none;" title="Voir">
                    <i class="fas fa-eye"></i>
                </a>
                <button onclick="this.closest('.ged-item').remove()" class="btn-icon" style="background:#ef4444; color:white; width:34px; height:34px; border:none; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
        fileInput.value = ""; nameInput.value = "";
    };
    reader.readAsDataURL(file);
};


// ============================================================
// 3. SAUVEGARDE SÉCURISÉE (Anti-Doublon)
// ============================================================
window.sauvegarderDossier = async function() {
    const btn = document.getElementById('btn-save-bdd');
    if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
    
    try {
        const idDossier = document.getElementById('dossier_id').value;
        const getVal = (id) => document.getElementById(id)?.value || "";
        
        // Données Texte
        let data = {
            date_modification: new Date().toISOString(),
            defunt: {
                civility: getVal('civilite_defunt'), nom: getVal('nom'), prenom: getVal('prenom'), nom_jeune_fille: getVal('nom_jeune_fille'),
                date_deces: getVal('date_deces'), lieu_deces: getVal('lieu_deces'), date_naiss: getVal('date_naiss'), lieu_naiss: getVal('lieu_naiss'),
                adresse: getVal('adresse_fr'), pere: getVal('pere'), mere: getVal('mere'), situation: getVal('matrimoniale'),
                conjoint: getVal('conjoint'), profession: getVal('profession_libelle')
            },
            mandant: { civility: getVal('civilite_mandant'), nom: getVal('soussigne'), lien: getVal('lien'), adresse: getVal('demeurant') },
            technique: {
                type_operation: document.getElementById('prestation').value, lieu_mise_biere: getVal('lieu_mise_biere'), date_fermeture: getVal('date_fermeture'),
                cimetiere: getVal('cimetiere_nom'), crematorium: getVal('crematorium_nom'), date_ceremonie: getVal('date_inhumation') || getVal('date_cremation'),
                heure_ceremonie: getVal('heure_inhumation') || getVal('heure_cremation'), num_concession: getVal('num_concession'), faita: getVal('faita'),
                date_signature: getVal('dateSignature'), police_nom: getVal('p_nom_grade'), police_commissariat: getVal('p_commissariat')
            },
            transport: { av_dep: getVal('av_lieu_depart'), av_arr: getVal('av_lieu_arrivee'), ap_dep: getVal('ap_lieu_depart'), ap_arr: getVal('ap_lieu_arrivee'), rap_pays: getVal('rap_pays'), rap_ville: getVal('rap_ville'), rap_lta: getVal('rap_lta') }
        };

        // Sauvegarde Dossier Principal
        let finalId = idDossier;
        if(idDossier) {
            await updateDoc(doc(db, "dossiers_admin", idDossier), data);
        } else {
            data.date_creation = new Date().toISOString();
            const docRef = await addDoc(collection(db, "dossiers_admin"), data);
            finalId = docRef.id;
            document.getElementById('dossier_id').value = finalId;
        }

        // Sauvegarde Fichiers (Un par un, seulement si nouveaux)
        const allGedItems = [];
        const elements = document.querySelectorAll('#liste_pieces_jointes .ged-item');
        
        for (const div of elements) {
            const name = div.getAttribute('data-name');
            const status = div.getAttribute('data-status');
            const b64 = div.getAttribute('data-b64');
            let storageId = div.getAttribute('data-storage-id');

            // On ne sauvegarde QUE si c'est nouveau ET qu'on a le contenu
            if (status === 'new' && b64) {
                try {
                    const fileDoc = await addDoc(collection(db, "ged_files"), {
                        nom: name,
                        content: b64,
                        dossier_parent: finalId,
                        date: new Date().toISOString()
                    });
                    storageId = fileDoc.id;
                    // Important : On marque comme stocké pour éviter les doublons si on reclique
                    div.setAttribute('data-status', 'stored');
                    div.setAttribute('data-storage-id', storageId);
                    console.log("Fichier sauvegardé :", name);
                } catch (err) {
                    console.error("Erreur fichier", err);
                    continue; 
                }
            }

            if (storageId) {
                allGedItems.push({ nom: name, ref_id: storageId });
            }
        }

        // Mise à jour de la liste dans le dossier
        await updateDoc(doc(db, "dossiers_admin", finalId), { ged: allGedItems });

        alert("✅ Sauvegarde terminée !");
        
        // On ne recharge pas toute la page, juste les données pour mettre au propre
        window.chargerDossier(finalId);
        if(window.chargerBaseClients) window.chargerBaseClients();

    } catch(e) { 
        console.error(e);
        alert("Erreur : " + e.message); 
    }
    
    if(btn) btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
};


// ============================================================
// 4. CHARGEMENT (Avec Gestion Hors-Ligne)
// ============================================================
window.chargerDossier = async function(id) {
    try {
        console.log("📂 Chargement...", id);
        const docRef = doc(db, "dossiers_admin", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) { alert("❌ Dossier introuvable."); return; }

        const data = docSnap.data();
        const set = (htmlId, val) => { const el = document.getElementById(htmlId); if(el) el.value = val || ''; };

        // Remplissage Champs
        if (data.defunt) {
            set('civilite_defunt', data.defunt.civility); set('nom', data.defunt.nom); set('prenom', data.defunt.prenom);
            set('nom_jeune_fille', data.defunt.nom_jeune_fille); set('date_deces', data.defunt.date_deces);
            set('lieu_deces', data.defunt.lieu_deces); set('date_naiss', data.defunt.date_naiss);
            set('lieu_naiss', data.defunt.lieu_naiss); set('adresse_fr', data.defunt.adresse);
            set('pere', data.defunt.pere); set('mere', data.defunt.mere);
            set('matrimoniale', data.defunt.situation); set('conjoint', data.defunt.conjoint);
            set('profession_libelle', data.defunt.profession);
        }
        if (data.mandant) {
            set('civilite_mandant', data.mandant.civility); set('soussigne', data.mandant.nom);
            set('lien', data.mandant.lien); set('demeurant', data.mandant.adresse);
        }
        if (data.technique) {
            const op = data.technique.type_operation || 'Inhumation';
            set('prestation', op); set('lieu_mise_biere', data.technique.lieu_mise_biere);
            set('date_fermeture', data.technique.date_fermeture); set('cimetiere_nom', data.technique.cimetiere);
            set('crematorium_nom', data.technique.crematorium); set('num_concession', data.technique.num_concession);
            set('faita', data.technique.faita); set('dateSignature', data.technique.date_signature);
            set('p_nom_grade', data.technique.police_nom); set('p_commissariat', data.technique.police_commissariat);
            if (op === 'Inhumation') { set('date_inhumation', data.technique.date_ceremonie); set('heure_inhumation', data.technique.heure_ceremonie); }
            else if (op === 'Crémation') { set('date_cremation', data.technique.date_ceremonie); set('heure_cremation', data.technique.heure_ceremonie); }
        }
        if (data.transport) {
            set('av_lieu_depart', data.transport.av_dep); set('av_lieu_arrivee', data.transport.av_arr);
            set('ap_lieu_depart', data.transport.ap_dep); set('ap_lieu_arrivee', data.transport.ap_arr);
            set('rap_pays', data.transport.rap_pays); set('rap_ville', data.transport.rap_ville); set('rap_lta', data.transport.rap_lta);
        }

        // --- GED ROBUSTE (Ne plante pas si hors ligne) ---
        const container = document.getElementById('liste_pieces_jointes');
        const rawGed = data.ged || data.pieces_jointes || [];
        
        if (container) {
            container.innerHTML = ""; 
            if (Array.isArray(rawGed) && rawGed.length > 0) {
                
                for (const item of rawGed) {
                    let nom = "";
                    let lien = "#";
                    let isBinary = false;
                    let storageId = null;
                    let statusLabel = "";
                    let statusColor = "#64748b";

                    // CAS 1 : Fichier Séparé (Nouveau système)
                    if (item.ref_id) {
                        nom = item.nom;
                        storageId = item.ref_id;
                        isBinary = true;
                        
                        try {
                            const fileSnap = await getDoc(doc(db, "ged_files", item.ref_id));
                            if (fileSnap.exists()) {
                                const fileData = fileSnap.data();
                                const res = await fetch(fileData.content);
                                const blob = await res.blob();
                                lien = URL.createObjectURL(blob);
                                statusLabel = "En ligne ✅";
                                statusColor = "#10b981";
                            } else {
                                isBinary = false; 
                                statusLabel = "Fichier introuvable";
                            }
                        } catch(err) { 
                            console.error("Erreur chargement fichier", err);
                            statusLabel = "Erreur Connexion ⚠️";
                            isBinary = false;
                        }

                    } 
                    // CAS 2 : Fichier Intégré (Ancien système)
                    else if (item.file) {
                        nom = item.nom;
                        isBinary = true;
                        statusLabel = "En ligne ✅";
                        statusColor = "#10b981";
                        try {
                            const res = await fetch(item.file);
                            const blob = await res.blob();
                            lien = URL.createObjectURL(blob);
                        } catch(e) { lien = item.file; }
                    } 
                    // CAS 3 : Nom seul
                    else {
                        nom = item;
                        statusLabel = "Ancien format";
                    }

                    if(typeof nom === 'string' && nom.includes("Enregistré")) continue;

                    const div = document.createElement('div');
                    div.className = "ged-item";
                    div.setAttribute('data-name', nom);
                    div.setAttribute('data-status', 'stored');
                    if(storageId) div.setAttribute('data-storage-id', storageId);

                    div.style = "display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
                    
                    const btnEye = isBinary 
                        ? `<a href="${lien}" target="_blank" class="btn-icon" style="background:#3b82f6; color:white; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px; text-decoration:none;" title="Voir"><i class="fas fa-eye"></i></a>`
                        : `<div style="background:#e2e8f0; color:#94a3b8; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px; cursor:not-allowed;" title="${statusLabel}"><i class="fas fa-eye-slash"></i></div>`;

                    div.innerHTML = `
                        <div style="display:flex; align-items:center; gap:12px;">
                            <i class="fas fa-file-pdf" style="color:#ef4444; font-size:1.6rem;"></i>
                            <div style="display:flex; flex-direction:column;">
                                <span style="font-weight:700; color:#334155; font-size:0.95rem;">${nom}</span>
                                <span style="font-size:0.75rem; color:${statusColor}; font-weight:600;">${statusLabel}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            ${btnEye}
                            <button onclick="this.closest('.ged-item').remove()" class="btn-icon" style="background:#ef4444; color:white; width:34px; height:34px; border:none; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                    container.appendChild(div);
                }
            } else {
                container.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">Aucun document joint.</div>';
            }
        }

        const hiddenId = document.getElementById('dossier_id');
        if(hiddenId) hiddenId.value = id;
        const btn = document.getElementById('btn-save-bdd');
        if (btn) {
            btn.innerHTML = `<i class="fas fa-pen"></i> MODIFIER LE DOSSIER`;
            btn.classList.remove('btn-green'); btn.classList.add('btn-warning'); 
            btn.style.backgroundColor = "#f59e0b"; 
            btn.onclick = function() { window.sauvegarderDossier(); };
        }

        if(window.toggleSections) window.toggleSections();
        if(window.togglePolice) window.togglePolice();
        if(window.toggleVol2) window.toggleVol2();
        window.showSection('admin');

    } catch (e) { console.error(e); alert("Erreur : " + e.message); }
};

// UI & Logic
window.toggleSections = function() {
    const select = document.getElementById('prestation'); if(!select) return;
    const choix = select.value;
    const map = { 'Inhumation': 'bloc_inhumation', 'Crémation': 'bloc_cremation', 'Rapatriement': 'bloc_rapatriement' };
    ['bloc_inhumation', 'bloc_cremation', 'bloc_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    ['btn_inhumation', 'btn_cremation', 'btn_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    if (map[choix]) {
        document.getElementById(map[choix])?.classList.remove('hidden');
        document.getElementById('btn_'+choix.toLowerCase().replace('é','e'))?.classList.remove('hidden');
    }
};
window.toggleVol2 = function() {
    const chk = document.getElementById('check_vol2');
    const bloc = document.getElementById('bloc_vol2');
    if(chk && bloc) { chk.checked ? bloc.classList.remove('hidden') : bloc.classList.add('hidden'); }
};
window.togglePolice = function() {
    const select = document.getElementById('type_presence_select');
    const bP = document.getElementById('police_fields'); const bF = document.getElementById('famille_fields');
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
window.showSection = function(id) {
    document.querySelectorAll('.main-content > div').forEach(div => { if(div.id.startsWith('view-')) div.classList.add('hidden'); });
    const target = document.getElementById('view-' + id);
    if(target) target.classList.remove('hidden');
    if(id === 'base') DB.chargerBaseClients();
    if(id === 'stock') DB.chargerStock();
    if(id === 'admin') DB.chargerSelectImport();
};
window.switchAdminTab = function(tabName) {
    document.getElementById('tab-content-identite').classList.add('hidden');
    document.getElementById('tab-content-technique').classList.add('hidden');
    document.getElementById('tab-btn-identite').classList.remove('active');
    document.getElementById('tab-btn-technique').classList.remove('active');
    document.getElementById('tab-content-' + tabName).classList.remove('hidden');
    document.getElementById('tab-btn-' + tabName).classList.add('active');
};
window.toggleSidebar = function() {
    const sb = document.querySelector('.sidebar');
    if(sb) sb.classList.toggle('collapsed');
};
window.loginFirebase = async function() {
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
    catch(e) { alert("Erreur login: " + e.message); }
};
window.logoutFirebase = async function() { await signOut(auth); window.location.reload(); };
onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('app-loader'); if(loader) loader.style.display = 'none';
    if(user) {
        document.getElementById('login-screen')?.classList.add('hidden');
        Utils.chargerLogoBase64();
        DB.chargerBaseClients();
        setTimeout(() => { if(window.toggleSections) window.toggleSections(); }, 500);
        setInterval(() => {
            const now = new Date();
            if(document.getElementById('header-time')) document.getElementById('header-time').innerText = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            if(document.getElementById('header-date')) document.getElementById('header-date').innerText = now.toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        }, 1000);
    } else { document.getElementById('login-screen')?.classList.remove('hidden'); }
});
