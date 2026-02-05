/* js/app.js - VERSION COMPLÈTE ET CORRIGÉE (05/02/2026) */

// 1. IMPORTS (Ne changez pas ça)
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// ============================================================
// A. EXPOSER LES FONCTIONS AU HTML (Indispensable pour vos boutons)
// ============================================================

// Base de données
window.chargerBaseClients = DB.chargerBaseClients;
window.chargerDossier = DB.chargerDossier;
window.sauvegarderDossier = DB.sauvegarderDossier;
window.supprimerDossier = DB.supprimerDossier;
window.viderFormulaire = DB.viderFormulaire;
window.chargerStock = DB.chargerStock;
window.ajouterArticleStock = DB.ajouterArticle; // Vérifiez si c'est ajouterArticle ou ajouterArticleStock dans db_manager
window.supprimerArticle = DB.supprimerArticle;
window.importerClientSelectionne = DB.importerClientSelectionne;
window.chargerSelectImport = DB.chargerSelectImport;

// PDF
window.genererPouvoir = PDF.genererPouvoir;
window.genererDeclaration = PDF.genererDeclaration;
window.genererFermeture = PDF.genererFermeture; // Police
window.genererDemandeFermetureMairie = PDF.genererDemandeFermetureMairie; // Mairie
window.genererTransport = PDF.genererTransport;
window.genererDemandeInhumation = PDF.genererDemandeInhumation;
window.genererDemandeCremation = PDF.genererDemandeCremation;
window.genererDemandeRapatriement = PDF.genererDemandeRapatriement;
window.genererDemandeOuverture = PDF.genererDemandeOuverture;


// ============================================================
// B. LOGIQUE D'INTERFACE (NAVIGATION & ONGLETS)
// ============================================================

// Navigation du Menu Gauche
window.showSection = function(id) {
    // 1. Cacher toutes les vues
    document.querySelectorAll('.main-content > div').forEach(div => {
        if(div.id.startsWith('view-')) div.classList.add('hidden');
    });

    // 2. Afficher la vue demandée
    const target = document.getElementById('view-' + id);
    if(target) target.classList.remove('hidden');

    // 3. Actions automatiques selon la vue
    if(id === 'base') DB.chargerBaseClients();
    if(id === 'stock') DB.chargerStock();
    if(id === 'admin') DB.chargerSelectImport();
};

// Menu Mobile (Burger)
window.toggleSidebar = function() {
    const sb = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if(window.innerWidth < 768) {
        // Mode Mobile
        sb.classList.toggle('mobile-open');
        if(overlay) overlay.style.display = sb.classList.contains('mobile-open') ? 'block' : 'none';
    } else {
        // Mode Bureau
        sb.classList.toggle('collapsed');
    }
};

// Onglets Dossier (Identité / Technique)
window.switchAdminTab = function(tabName) {
    // Cacher les contenus
    document.getElementById('tab-content-identite').classList.add('hidden');
    document.getElementById('tab-content-technique').classList.add('hidden');
    
    // Désactiver les boutons
    document.getElementById('tab-btn-identite').classList.remove('active');
    document.getElementById('tab-btn-technique').classList.remove('active');

    // Activer celui demandé
    document.getElementById('tab-content-' + tabName).classList.remove('hidden');
    document.getElementById('tab-btn-' + tabName).classList.add('active');
};

// ============================================================
// C. LOGIQUE MÉTIER (LES FONCTIONS QUI MANQUAIENT)
// ============================================================

// 1. Gestion Affichage (Inhumation / Crémation / Rapatriement)
window.toggleSections = function() {
    const select = document.getElementById('prestation');
    if(!select) return;
    const choix = select.value;

    // Récupération des blocs
    const bInhum = document.getElementById('bloc_inhumation');
    const bCrem = document.getElementById('bloc_cremation');
    const bRap = document.getElementById('bloc_rapatriement');
    
    // Récupération des boutons PDF
    const btnInhum = document.getElementById('btn_inhumation');
    const btnCrem = document.getElementById('btn_cremation');
    const btnRap = document.getElementById('btn_rapatriement');

    // Tout cacher par défaut
    if(bInhum) bInhum.classList.add('hidden');
    if(bCrem) bCrem.classList.add('hidden');
    if(bRap) bRap.classList.add('hidden');
    
    if(btnInhum) btnInhum.classList.add('hidden');
    if(btnCrem) btnCrem.classList.add('hidden');
    if(btnRap) btnRap.classList.add('hidden');

    // Afficher selon le choix
    if(choix === "Inhumation") {
        if(bInhum) bInhum.classList.remove('hidden');
        if(btnInhum) btnInhum.classList.remove('hidden');
    }
    else if(choix === "Crémation") {
        if(bCrem) bCrem.classList.remove('hidden');
        if(btnCrem) btnCrem.classList.remove('hidden');
    }
    else if(choix === "Rapatriement") {
        if(bRap) bRap.classList.remove('hidden');
        if(btnRap) btnRap.classList.remove('hidden');
    }
};

// 2. Gestion Vol 2 (Rapatriement)
window.toggleVol2 = function() {
    const chk = document.getElementById('check_vol2');
    const bloc = document.getElementById('bloc_vol2');
    if(chk && bloc) {
        if(chk.checked) bloc.classList.remove('hidden');
        else bloc.classList.add('hidden');
    }
};

// 3. Gestion Police vs Famille
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

// 4. Copie Automatique Mandant -> Témoin
window.copierMandant = function() {
    const chk = document.getElementById('copy_mandant');
    if(chk && chk.checked) {
        const nom = document.getElementById('soussigne').value; // Nom Mandant
        const lien = document.getElementById('lien').value; // Lien Mandant
        
        if(document.getElementById('f_nom_prenom')) document.getElementById('f_nom_prenom').value = nom;
        if(document.getElementById('f_lien')) document.getElementById('f_lien').value = lien;
    }
};

// 5. GED (Pièces Jointes) avec Visionneuse
window.ajouterPieceJointe = function() {
    const container = document.getElementById('liste_pieces_jointes');
    const fileInput = document.getElementById('ged_input_file');
    const nameInput = document.getElementById('ged_file_name');

    if (fileInput.files.length === 0) {
        alert("⚠️ Veuillez sélectionner un fichier.");
        return;
    }

    const file = fileInput.files[0];
    const nomDoc = nameInput.value || file.name;
    const fileURL = URL.createObjectURL(file);

    // Enlever le message "Aucun document"
    if(container.innerText.includes('Aucun')) container.innerHTML = "";

    const div = document.createElement('div');
    div.style = "background:white; padding:8px; margin-bottom:5px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; border-radius:6px;";
    
    div.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <i class="fas fa-file-pdf" style="color:#ef4444;"></i>
            <span style="font-weight:600; color:#334155;">${nomDoc}</span>
        </div>
        <div style="display:flex; gap:10px;">
            <a href="${fileURL}" target="_blank" style="color:#10b981; cursor:pointer; font-size:1.1rem;" title="Voir">
                <i class="fas fa-eye"></i>
            </a>
            <i class="fas fa-trash-alt" style="color:#ef4444; cursor:pointer; font-size:1.1rem;" onclick="this.parentElement.parentElement.remove()"></i>
        </div>
    `;
    container.appendChild(div);

    // Reset
    fileInput.value = "";
    nameInput.value = "";
};


// ============================================================
// D. AUTHENTIFICATION & INITIALISATION
// ============================================================

window.loginFirebase = async function() {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
    } catch(e) {
        alert("Erreur de connexion : " + e.message);
    }
};

window.logoutFirebase = async function() {
    await signOut(auth);
    window.location.reload();
};

// Écouteur d'état (Se lance au démarrage)
onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('app-loader');
    if(loader) loader.style.display = 'none'; // Fin du chargement
    
    if(user) {
        // UTILISATEUR CONNECTÉ
        document.getElementById('login-screen')?.classList.add('hidden');
        Utils.chargerLogoBase64();
        
        // Chargements initiaux
        DB.chargerBaseClients();
        if(document.getElementById('view-stock') && !document.getElementById('view-stock').classList.contains('hidden')) {
            DB.chargerStock();
        }

        // Horloge
        setInterval(() => {
            const now = new Date();
            if(document.getElementById('header-time')) document.getElementById('header-time').innerText = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            if(document.getElementById('header-date')) document.getElementById('header-date').innerText = now.toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        }, 1000);

        // Petit délai pour initialiser l'affichage technique correct
        setTimeout(() => {
            if(window.toggleSections) window.toggleSections();
        }, 500);

    } else {
        // UTILISATEUR DÉCONNECTÉ
        document.getElementById('login-screen')?.classList.remove('hidden');
    }
});

// --- GESTION DU BOUTON (ENREGISTRER vs MODIFIER) ---

// Fonction pour changer l'apparence du bouton
window.updateSaveButton = function(mode) {
    const btn = document.getElementById('btn-save-bdd');
    if (!btn) return;

    if (mode === 'edit') {
        // Mode MODIFICATION (Orange)
        btn.innerHTML = '<i class="fas fa-pen"></i> MODIFIER';
        btn.classList.remove('btn-green');
        btn.classList.add('btn-warning'); // Si vous avez une classe orange/jaune
        btn.style.backgroundColor = "#f59e0b"; // Force la couleur orange
    } else {
        // Mode CRÉATION (Vert)
        btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
        btn.classList.add('btn-green');
        btn.classList.remove('btn-warning');
        btn.style.backgroundColor = ""; // Remet la couleur par défaut
    }
};

// On modifie la fonction existante de chargement pour activer le mode 'edit'
const originalChargerDossier = window.chargerDossier;
window.chargerDossier = async function(id) {
    // 1. On appelle la fonction normale de chargement
    if(originalChargerDossier) await originalChargerDossier(id);
    
    // 2. On change le bouton en "MODIFIER"
    window.updateSaveButton('edit');
};

// On modifie la fonction vider pour remettre en "ENREGISTRER"
const originalVider = window.viderFormulaire;
window.viderFormulaire = function() {
    if(originalVider) originalVider();
    
    // On remet le bouton en "ENREGISTRER"
    window.updateSaveButton('new');
};
