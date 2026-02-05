/* js/app.js - VERSION FINALE CORRIGÉE (05/02/2026) */

// 1. IMPORTS ESSENTIELS (C'est ici que ça bloquait !)
import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
// On importe les outils Firestore directement depuis Internet pour éviter l'erreur "window.doc"
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// ============================================================
// A. CONNECTION AU HTML (Pour que vos boutons marchent)
// ============================================================
// On "attache" les fonctions au navigateur
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
// B. FONCTION DE CHARGEMENT INTELLIGENTE (Celle qui plantait)
// ============================================================
window.chargerDossier = async function(id) {
    try {
        console.log("Tentative de chargement du dossier...", id);
        
        // CORRECTION : On utilise les fonctions importées (plus de window.doc)
        const docRef = doc(db, "dossiers", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("Ce dossier est introuvable (peut-être supprimé ?)");
            return;
        }

        const data = docSnap.data();
        console.log("Données reçues :", data);

        // 1. Remplissage Automatique des champs
        for (const [key, value] of Object.entries(data)) {
            const input = document.getElementById(key);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value;
                } else {
                    input.value = value;
                }
            }
        }

        // 2. Gestion de la GED (Pièces Jointes)
        const container = document.getElementById('liste_pieces_jointes');
        if (container) {
            container.innerHTML = ""; // On nettoie la liste
            
            if (data.pieces_jointes && Array.isArray(data.pieces_jointes) && data.pieces_jointes.length > 0) {
                data.pieces_jointes.forEach(nomFichier => {
                    const div = document.createElement('div');
                    div.style = "background:white; padding:8px; margin-bottom:5px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; border-radius:4px;";
                    // NOTE : Pour les dossiers sauvegardés, on affiche un Validé vert ✅
                    // car le fichier réel n'est pas stocké dans le Cloud, seul son nom l'est.
                    div.innerHTML = `
                        <span style="font-weight:600; color:#334155;">📄 ${nomFichier}</span>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span style="font-size:0.8rem; color:green;">Enregistré ✅</span>
                            <i class="fas fa-trash-alt" style="color:#ef4444; cursor:pointer; margin-left:10px;" onclick="this.parentElement.parentElement.remove()"></i>
                        </div>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<div style="color:#94a3b8; font-style:italic;">Aucun document joint.</div>';
            }
        }

        // 3. Mise à jour du Bouton en mode "MODIFIER"
        const hiddenId = document.getElementById('dossier_id');
        if(hiddenId) hiddenId.value = id;

        const btn = document.getElementById('btn-save-bdd');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-pen"></i> MODIFIER LE DOSSIER';
            btn.classList.remove('btn-green');
            btn.classList.add('btn-warning'); 
            btn.style.backgroundColor = "#f59e0b"; // Orange
            // On force le clic à sauvegarder CE dossier spécifique
            btn.onclick = function() { window.sauvegarderDossier(id); };
        }

        // 4. Réactiver les blocs masqués (Rapatriement, Police...)
        if(window.toggleSections) window.toggleSections();
        if(window.togglePolice) window.togglePolice();
        if(window.toggleVol2) window.toggleVol2();

        // 5. Afficher la page
        window.showSection('admin');

    } catch (e) {
        console.error("Erreur critique chargement:", e);
        alert("Erreur lors du chargement : " + e.message);
    }
};


// ============================================================
// C. LOGIQUE D'INTERFACE & OUTILS
// ============================================================

window.toggleSections = function() {
    const select = document.getElementById('prestation');
    if(!select) return;
    const choix = select.value;
    
    // Identifiants des blocs
    const blocs = {
        'Inhumation': 'bloc_inhumation',
        'Crémation': 'bloc_cremation',
        'Rapatriement': 'bloc_rapatriement'
    };
    
    // Tout cacher
    Object.values(blocs).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    // Afficher le bon
    if(blocs[choix]) {
        const el = document.getElementById(blocs[choix]);
        if(el) el.classList.remove('hidden');
    }
    
    // Gestion des boutons PDF à droite
    const btnInhum = document.getElementById('btn_inhumation');
    const btnCrem = document.getElementById('btn_cremation');
    const btnRap = document.getElementById('btn_rapatriement');
    
    if(btnInhum) btnInhum.classList.add('hidden');
    if(btnCrem) btnCrem.classList.add('hidden');
    if(btnRap) btnRap.classList.add('hidden');

    if(choix === 'Inhumation' && btnInhum) btnInhum.classList.remove('hidden');
    if(choix === 'Crémation' && btnCrem) btnCrem.classList.remove('hidden');
    if(choix === 'Rapatriement' && btnRap) btnRap.classList.remove('hidden');
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
            <a href="${fileURL}" target="_blank" style="color:#10b981; cursor:pointer;" title="Voir maintenant">
                <i class="fas fa-eye"></i>
            </a>
            <i class="fas fa-trash-alt" style="color:#ef4444; cursor:pointer;" onclick="this.parentElement.parentElement.remove()"></i>
        </div>
    `;
    container.appendChild(div);
    fileInput.value = ""; nameInput.value = "";
};

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
// D. AUTHENTIFICATION (Démarrage)
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
