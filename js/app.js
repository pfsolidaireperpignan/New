/* js/app.js - CONNECTION ET UI (Version Réparée) */
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// --- 1. RENDRE LES FONCTIONS DB ACCESSIBLES AU HTML ---
window.chargerBaseClients = DB.chargerBaseClients;
window.chargerDossier = DB.chargerDossier;
window.supprimerDossier = DB.supprimerDossier;
window.viderFormulaire = DB.viderFormulaire;
window.chargerStock = DB.chargerStock; 
window.sauvegarderDossier = DB.sauvegarderDossier; 
window.importerClientSelectionne = DB.importerClientSelectionne;

// Fonctions PDF
window.genererPouvoir = PDF.genererPouvoir;
window.genererDeclaration = PDF.genererDeclaration;
window.genererDemandeInhumation = PDF.genererDemandeInhumation;
// (Vous pouvez ajouter les autres ici si besoin)

// --- 2. FONCTIONS D'INTERFACE (Celles qui manquaient !) ---

// Navigation principale (Menu Gauche)
window.showSection = function(id) {
    document.querySelectorAll('.main-content > div').forEach(div => { 
        if(div.id.startsWith('view-')) div.classList.add('hidden'); 
    });
    const target = document.getElementById('view-' + id);
    if(target) target.classList.remove('hidden');

    // Chargement dynamique des données
    if(id === 'base') DB.chargerBaseClients();
    if(id === 'admin') DB.chargerSelectImport(); // Charge la liste pour l'import
};

// Onglets du Dossier Admin (Identité / Technique)
window.switchAdminTab = function(tab) {
    // Cacher les contenus
    document.getElementById('tab-content-identite').classList.add('hidden'); 
    document.getElementById('tab-content-technique').classList.add('hidden');
    
    // Désactiver les boutons
    document.getElementById('tab-btn-identite').classList.remove('active');
    document.getElementById('tab-btn-technique').classList.remove('active');

    // Activer la sélection
    document.getElementById('tab-content-' + tab).classList.remove('hidden');
    document.getElementById('tab-btn-' + tab).classList.add('active');
};

// Gestion du Menu Latéral (Burger)
window.toggleSidebar = function() { 
    const sb = document.querySelector('.sidebar'); 
    if(sb) sb.classList.toggle('collapsed'); 
};

// Fonction GED (Ajouter un fichier visuellement)
window.ajouterPieceJointe = function() {
    const container = document.getElementById('liste_pieces_jointes');
    // Si c'est le texte par défaut "Aucun document", on le vide
    if(container.innerText.includes('Aucun document')) container.innerHTML = "";
    
    const nomFichier = prompt("Nom du document (ex: Livret de famille) :");
    if(nomFichier) {
        const div = document.createElement('div');
        div.style = "background:white; padding:8px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border-radius:6px;";
        div.innerHTML = `
            <span>📄 ${nomFichier}</span>
            <i class="fas fa-trash" style="color:#ef4444; cursor:pointer;" onclick="this.parentElement.remove()"></i>
        `;
        container.appendChild(div);
    }
};

// --- 3. INITIALISATION ET AUTHENTIFICATION ---
onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('app-loader');
    if(loader) loader.style.display = 'none'; // Cache le chargement infini
    
    if(user) { 
        document.getElementById('login-screen')?.classList.add('hidden'); 
        Utils.chargerLogoBase64(); 
        
        // Connexion manuelle des boutons (au cas où onclick HTML échoue)
        const btnSave = document.getElementById('btn-save-bdd');
        if(btnSave) btnSave.onclick = DB.sauvegarderDossier;
        
        const btnImport = document.getElementById('btn-import');
        if(btnImport) btnImport.onclick = DB.importerClientSelectionne;
        
    } else { 
        document.getElementById('login-screen')?.classList.remove('hidden'); 
    }
});

window.loginFirebase = async function() { 
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); 
    } catch(e) { alert("Erreur login : " + e.message); } 
};

window.logoutFirebase = async function() { 
    await signOut(auth); 
    window.location.reload(); 
};
// --- FONCTION MANQUANTE : GESTION DES BLOCS (INHUMATION / CREMATION / RAPATRIEMENT) ---
window.toggleSections = function() {
    // 1. Récupérer la valeur choisie
    const select = document.getElementById('prestation');
    if (!select) return; // Sécurité si l'élément n'existe pas
    const choix = select.value;

    // 2. Récupérer les blocs HTML (Sections du formulaire)
    const blocInhum = document.getElementById('bloc_inhumation');
    const blocCrem = document.getElementById('bloc_cremation');
    const blocRap = document.getElementById('bloc_rapatriement');

    // 3. Récupérer les boutons PDF correspondants (Colonne de droite)
    const btnInhum = document.getElementById('btn_inhumation');
    const btnCrem = document.getElementById('btn_cremation');
    const btnRap = document.getElementById('btn_rapatriement');

    // 4. TOUT CACHER D'ABORD (Remise à zéro)
    // On ajoute la classe 'hidden' partout
    if(blocInhum) blocInhum.classList.add('hidden');
    if(blocCrem) blocCrem.classList.add('hidden');
    if(blocRap) blocRap.classList.add('hidden');
    
    if(btnInhum) btnInhum.classList.add('hidden');
    if(btnCrem) btnCrem.classList.add('hidden');
    if(btnRap) btnRap.classList.add('hidden');

    // 5. AFFICHER SEULEMENT CE QUI EST CHOISI
    if (choix === "Inhumation") {
        if(blocInhum) blocInhum.classList.remove('hidden');
        if(btnInhum) btnInhum.classList.remove('hidden');
    } 
    else if (choix === "Crémation") {
        if(blocCrem) blocCrem.classList.remove('hidden');
        if(btnCrem) btnCrem.classList.remove('hidden');
    } 
    else if (choix === "Rapatriement") {
        if(blocRap) blocRap.classList.remove('hidden');
        if(btnRap) btnRap.classList.remove('hidden');
    }
};

// Petite astuce : On lance la fonction une fois au démarrage pour que l'affichage soit correct dès le début
// (Attendre un tout petit peu que le HTML soit chargé)
setTimeout(() => {
    if(window.toggleSections) window.toggleSections();
}, 500);
// --- FONCTION POUR AFFICHER/CACHER LE VOL 2 ---
window.toggleVol2 = function() {
    // 1. On regarde si la case est cochée
    const checkbox = document.getElementById('check_vol2');
    const blocVol2 = document.getElementById('bloc_vol2');

    // Sécurité : si un des éléments n'existe pas, on arrête
    if (!checkbox || !blocVol2) return;

    // 2. Si coché => on affiche. Sinon => on cache.
    if (checkbox.checked) {
        blocVol2.classList.remove('hidden');
    } else {
        blocVol2.classList.add('hidden');
    }
};
