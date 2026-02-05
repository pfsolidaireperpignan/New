/* js/app.js - VERSION FINALE (CORRECTIF dossiers_admin) */

// 1. IMPORTS
import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
// Import des outils Firestore pour lire la base
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// 2. CONNECTION AU HTML
// On connecte les fonctions de DB_Manager, SAUF chargerDossier qu'on va réécrire ici
window.chargerBaseClients = DB.chargerBaseClients;
window.sauvegarderDossier = DB.sauvegarderDossier;
window.supprimerDossier = DB.supprimerDossier;
window.viderFormulaire = DB.viderFormulaire;
window.chargerStock = DB.chargerStock;
window.ajouterArticleStock = DB.ajouterArticle;
window.supprimerArticle = DB.supprimerArticle;
window.importerClientSelectionne = DB.importerClientSelectionne;
window.chargerSelectImport = DB.chargerSelectImport;

// Fonctions PDF
window.genererPouvoir = PDF.genererPouvoir;
window.genererDeclaration = PDF.genererDeclaration;
window.genererFermeture = PDF.genererFermeture;
window.genererDemandeFermetureMairie = PDF.genererDemandeFermetureMairie;
window.genererTransport = PDF.genererTransport;
window.genererDemandeInhumation = PDF.genererDemandeInhumation;
window.genererDemandeCremation = PDF.genererDemandeCremation;
window.genererDemandeRapatriement = PDF.genererDemandeRapatriement;
window.genererDemandeOuverture = PDF.genererDemandeOuverture;


// ============================================================
// 3. LA FONCTION DE CHARGEMENT (Celle qui répare tout)
// ============================================================
window.chargerDossier = async function(id) {
    try {
        console.log("📂 Chargement du dossier (dossiers_admin) :", id);
        
        // CIBLE PRÉCISE : On vise 'dossiers_admin' (c'est le nom dans votre db_manager.js)
        const docRef = doc(db, "dossiers_admin", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("❌ Dossier introuvable dans 'dossiers_admin'.\nIl a peut-être été supprimé.");
            return;
        }

        const data = docSnap.data();
        console.log("✅ Données reçues :", data);

        // Petit outil pour remplir les champs sans faire planter si l'ID n'existe pas
        const set = (htmlId, val) => { 
            const el = document.getElementById(htmlId);
            if(el) el.value = val || ''; 
        };

        // --- A. DEBALLAGE DES CARTONS (Mapping) ---
        
        // 1. DÉFUNT
        if (data.defunt) {
            set('civilite_defunt', data.defunt.civility);
            set('nom', data.defunt.nom);
            set('prenom', data.defunt.prenom);
            set('nom_jeune_fille', data.defunt.nom_jeune_fille);
            set('date_deces', data.defunt.date_deces);
            set('lieu_deces', data.defunt.lieu_deces);
            set('date_naiss', data.defunt.date_naiss);
            set('lieu_naiss', data.defunt.lieu_naiss);
            set('adresse_fr', data.defunt.adresse); // Attention au nom différent
            set('pere', data.defunt.pere);
            set('mere', data.defunt.mere);
            set('matrimoniale', data.defunt.situation);
            set('conjoint', data.defunt.conjoint);
            set('profession_libelle', data.defunt.profession);
        }

        // 2. MANDANT
        if (data.mandant) {
            set('civilite_mandant', data.mandant.civility);
            set('soussigne', data.mandant.nom); // Nom du mandant
            set('lien', data.mandant.lien);
            set('demeurant', data.mandant.adresse);
        }

        // 3. TECHNIQUE & OBSÈQUES
        if (data.technique) {
            const op = data.technique.type_operation || 'Inhumation';
            set('prestation', op);
            
            set('lieu_mise_biere', data.technique.lieu_mise_biere);
            set('date_fermeture', data.technique.date_fermeture);
            set('cimetiere_nom', data.technique.cimetiere);
            set('crematorium_nom', data.technique.crematorium);
            set('num_concession', data.technique.num_concession);
            set('faita', data.technique.faita);
            set('dateSignature', data.technique.date_signature);
            set('p_nom_grade', data.technique.police_nom);
            set('p_commissariat', data.technique.police_commissariat);

            // Gestion intelligente des dates (Inhumation vs Crémation)
            if (op === 'Inhumation') {
                set('date_inhumation', data.technique.date_ceremonie);
                set('heure_inhumation', data.technique.heure_ceremonie);
            } else if (op === 'Crémation') {
                set('date_cremation', data.technique.date_ceremonie);
                set('heure_cremation', data.technique.heure_ceremonie);
            }
        }

        // 4. TRANSPORT
        if (data.transport) {
            set('av_lieu_depart', data.transport.av_dep);
            set('av_lieu_arrivee', data.transport.av_arr);
            set('ap_lieu_depart', data.transport.ap_dep);
            set('ap_lieu_arrivee', data.transport.ap_arr);
            set('rap_pays', data.transport.rap_pays);
            set('rap_ville', data.transport.rap_ville);
            set('rap_lta', data.transport.rap_lta);
        }

        // --- B. LA GED (Liste des fichiers) ---
        // Dans db_manager, c'est enregistré sous "ged", pas "pieces_jointes"
        const gedList = data.ged || data.pieces_jointes || [];
        const container = document.getElementById('liste_pieces_jointes');
        
        if (container) {
            container.innerHTML = ""; 
            if (Array.isArray(gedList) && gedList.length > 0) {
                gedList.forEach(nomFichier => {
                    const div = document.createElement('div');
                    div.style = "background:white; padding:8px; margin-bottom:5px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; border-radius:4px;";
                    div.innerHTML = `
                        <span style="font-weight:600; color:#334155;">📄 ${nomFichier}</span>
                        <span style="font-size:0.8rem; color:green; font-weight:bold;">Enregistré ✅</span>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<div style="color:#94a3b8; font-style:italic;">Aucun document joint.</div>';
            }
        }

        // --- C. FINALISATION ---
        // On passe l'ID caché pour que le bouton "Enregistrer" devienne "Modifier"
        const hiddenId = document.getElementById('dossier_id');
        if(hiddenId) hiddenId.value = id;

        const btn = document.getElementById('btn-save-bdd');
        if (btn) {
            btn.innerHTML = `<i class="fas fa-pen"></i> MODIFIER LE DOSSIER`;
            btn.classList.remove('btn-green');
            btn.classList.add('btn-warning'); 
            btn.style.backgroundColor = "#f59e0b"; // Orange
            
            // On s'assure que le clic déclenche bien la sauvegarde
            // (La fonction sauvegarderDossier de db_manager lit l'ID caché 'dossier_id', donc ça marchera)
            btn.onclick = function() { window.sauvegarderDossier(); };
        }

        // On rafraîchit l'affichage des sections (Inhumation/Crémation)
        if(window.toggleSections) window.toggleSections();
        if(window.togglePolice) window.togglePolice();
        if(window.toggleVol2) window.toggleVol2();

        // On affiche l'onglet Admin
        window.showSection('admin');

    } catch (e) {
        console.error("Erreur chargement:", e);
        alert("Erreur technique : " + e.message);
    }
};


// ============================================================
// 4. LOGIQUE D'INTERFACE (UI) - Obligatoire pour l'affichage
// ============================================================

window.toggleSections = function() {
    const select = document.getElementById('prestation');
    if(!select) return;
    const choix = select.value;
    
    // Identifiants
    const map = {
        'Inhumation': { bloc: 'bloc_inhumation', btn: 'btn_inhumation' },
        'Crémation': { bloc: 'bloc_cremation', btn: 'btn_cremation' },
        'Rapatriement': { bloc: 'bloc_rapatriement', btn: 'btn_rapatriement' }
    };

    // Tout cacher
    ['bloc_inhumation', 'bloc_cremation', 'bloc_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    ['btn_inhumation', 'btn_cremation', 'btn_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));

    // Afficher le bon
    if (map[choix]) {
        document.getElementById(map[choix].bloc)?.classList.remove('hidden');
        document.getElementById(map[choix].btn)?.classList.remove('hidden');
    }
};

window.toggleVol2 = function() {
    const chk = document.getElementById('check_vol2');
    const bloc = document.getElementById('bloc_vol2');
    if(chk && bloc) {
        if(chk.checked) bloc.classList.remove('hidden');
        else bloc.classList.add('hidden');
    }
};

window.togglePolice = function() {
    const select = document.getElementById('type_presence_select');
    const blocPolice = document.getElementById('police_fields');
    const blocFamille = document.getElementById('famille_fields');
    if(!select) return;
    
    if(select.value === 'police') {
        if(blocPolice) blocPolice.classList.remove('hidden');
        if(blocFamille) blocFamille.classList.add('hidden');
    } else {
        if(blocPolice) blocPolice.classList.add('hidden');
        if(blocFamille) blocFamille.classList.remove('hidden');
    }
};

window.copierMandant = function() {
    const chk = document.getElementById('copy_mandant');
    if(chk && chk.checked) {
        const nom = document.getElementById('soussigne').value;
        const lien = document.getElementById('lien').value;
        if(document.getElementById('f_nom_prenom')) document.getElementById('f_nom_prenom').value = nom;
        if(document.getElementById('f_lien')) document.getElementById('f_lien').value = lien;
    }
};

window.ajouterPieceJointe = function() {
    const container = document.getElementById('liste_pieces_jointes');
    const fileInput = document.getElementById('ged_input_file');
    const nameInput = document.getElementById('ged_file_name');

    if (fileInput.files.length === 0) { alert("⚠️ Sélectionnez un fichier."); return; }

    const file = fileInput.files[0];
    const nomDoc = nameInput.value || file.name;
    const fileURL = URL.createObjectURL(file);

    if(container.innerText.includes('Aucun')) container.innerHTML = "";

    const div = document.createElement('div');
    div.style = "background:white; padding:8px; margin-bottom:5px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; border-radius:4px;";
    div.innerHTML = `
        <span style="font-weight:600; color:#334155;">📄 ${nomDoc}</span>
        <div style="display:flex; gap:10px;">
            <a href="${fileURL}" target="_blank" style="color:#10b981; cursor:pointer;" title="Voir">
                <i class="fas fa-eye"></i>
            </a>
            <i class="fas fa-trash-alt" style="color:#ef4444; cursor:pointer;" onclick="this.parentElement.parentElement.remove()"></i>
        </div>
    `;
    container.appendChild(div);
    fileInput.value = ""; nameInput.value = "";
};

// Navigation
window.showSection = function(id) {
    document.querySelectorAll('.main-content > div').forEach(div => {
        if(div.id.startsWith('view-')) div.classList.add('hidden');
    });
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
    const overlay = document.getElementById('mobile-overlay');
    if(window.innerWidth < 768) {
        sb.classList.toggle('mobile-open');
        if(overlay) overlay.style.display = sb.classList.contains('mobile-open') ? 'block' : 'none';
    } else {
        sb.classList.toggle('collapsed');
    }
};

// ============================================================
// 5. AUTHENTIFICATION (Lancement)
// ============================================================
window.loginFirebase = async function() {
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
    catch(e) { alert("Erreur login: " + e.message); }
};
window.logoutFirebase = async function() { await signOut(auth); window.location.reload(); };

onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('app-loader');
    if(loader) loader.style.display = 'none';
    
    if(user) {
        document.getElementById('login-screen')?.classList.add('hidden');
        Utils.chargerLogoBase64();
        DB.chargerBaseClients();
        // Petite attente pour l'UI
        setTimeout(() => { if(window.toggleSections) window.toggleSections(); }, 500);
        
        // Horloge
        setInterval(() => {
            const now = new Date();
            if(document.getElementById('header-time')) document.getElementById('header-time').innerText = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            if(document.getElementById('header-date')) document.getElementById('header-date').innerText = now.toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        }, 1000);
    } else {
        document.getElementById('login-screen')?.classList.remove('hidden');
    }
});
