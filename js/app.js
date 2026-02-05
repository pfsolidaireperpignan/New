/* js/app.js - VERSION CORRIGÉE (Onglets + PDF + Import) */
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import * as Utils from './utils.js';
import * as DB from './db_manager.js';

// IMPORTANT : On importe simplement le fichier pour qu'il s'exécute et attache les fonctions à window
import './pdf_admin.js'; 

// --- 1. FONCTIONS GLOBALES (Navigation & UI) ---

// Gestion des onglets "Identité" / "Technique"
window.switchAdminTab = function(tab) {
    // Masquer tous les contenus
    document.getElementById('tab-content-identite').classList.add('hidden');
    document.getElementById('tab-content-technique').classList.add('hidden');
    
    // Désactiver tous les boutons
    document.getElementById('tab-btn-identite').classList.remove('active');
    document.getElementById('tab-btn-technique').classList.remove('active');
    
    // Activer la cible
    document.getElementById('tab-content-' + tab).classList.remove('hidden');
    document.getElementById('tab-btn-' + tab).classList.add('active');
};

// Affichage des sections (Accueil, Admin, Stock...)
window.showSection = function(id) {
    ['home', 'admin', 'base', 'stock'].forEach(v => {
        const el = document.getElementById('view-' + v);
        if(el) el.classList.add('hidden');
    });
    
    const target = document.getElementById('view-' + id);
    if(target) target.classList.remove('hidden');

    // Chargement dynamique des données
    if(id === 'base') DB.chargerBaseClients();
    if(id === 'stock') DB.chargerStock();
    if(id === 'admin') DB.chargerSelectImport(); // <-- On charge la liste déroulante ici !
    
    // Gestion menu mobile
    if(window.innerWidth < 768) {
        const sidebar = document.querySelector('.sidebar');
        if(sidebar) sidebar.classList.remove('mobile-open');
        const overlay = document.getElementById('mobile-overlay');
        if(overlay) overlay.style.display = 'none';
    }
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

window.toggleSections = function() {
    const type = document.getElementById('prestation').value;
    document.querySelectorAll('.specific-block').forEach(el => el.classList.add('hidden'));
    
    if(type === 'Inhumation') document.getElementById('bloc_inhumation').classList.remove('hidden');
    if(type === 'Crémation') document.getElementById('bloc_cremation').classList.remove('hidden');
    if(type === 'Rapatriement') document.getElementById('bloc_rapatriement').classList.remove('hidden');
    
    // Boutons PDF contextuels
    document.getElementById('btn_inhumation').classList.add('hidden');
    document.getElementById('btn_cremation').classList.add('hidden');
    document.getElementById('btn_rapatriement').classList.add('hidden');
    
    if(type === 'Inhumation') document.getElementById('btn_inhumation').classList.remove('hidden');
    if(type === 'Crémation') document.getElementById('btn_cremation').classList.remove('hidden');
    if(type === 'Rapatriement') document.getElementById('btn_rapatriement').classList.remove('hidden');
};

// --- 2. EXPOSITION DES FONCTIONS DB ---
window.chargerBaseClients = DB.chargerBaseClients;
window.chargerDossier = DB.chargerDossier;
window.sauvegarderDossier = DB.sauvegarderDossier;
window.supprimerDossier = DB.supprimerDossier;
window.chargerStock = DB.chargerStock;
window.ajouterArticleStock = DB.ajouterArticle;
window.supprimerArticle = DB.supprimerArticle;
window.viderFormulaire = DB.viderFormulaire; // Nouvelle fonction pour le bouton "Nouveau"

// --- 3. AUTHENTIFICATION ---
window.loginFirebase = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch(e) { alert("Erreur connexion : " + e.message); }
};

window.logoutFirebase = async function() {
    await signOut(auth);
    window.location.reload();
};

// --- 4. INITIALISATION ---
onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('app-loader');
    if(loader) loader.style.display = 'none';
    
    if(user) {
        document.getElementById('login-screen').classList.add('hidden');
        Utils.chargerLogoBase64();
        
        // Gestion bouton import
        const btnImport = document.getElementById('btn-import');
        if(btnImport) btnImport.onclick = DB.importerClientSelectionne;

        // Horloge
        setInterval(() => {
            const now = new Date();
            const timeEl = document.getElementById('header-time');
            const dateEl = document.getElementById('header-date');
            if(timeEl) timeEl.innerText = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            if(dateEl) dateEl.innerText = now.toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        }, 1000);
        
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
    }
});

// --- 5. FONCTIONS UI GED (A ajouter à la fin de app.js) ---
window.ajouterPieceJointe = function() {
    const input = document.getElementById('ged_input_file');
    const nameInput = document.getElementById('ged_file_name');
    const container = document.getElementById('liste_pieces_jointes');
    
    // On prend le nom saisi, ou le nom du fichier, ou "Document"
    let fileName = nameInput.value || (input.files[0] ? input.files[0].name : "Document");
    
    if(container.innerHTML.includes('Aucun document')) container.innerHTML = "";
    
    const div = document.createElement('div');
    div.style = "background:white; padding:5px 10px; border-radius:4px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;";
    div.innerHTML = `
        <span><i class="fas fa-file-pdf" style="color:#ef4444; margin-right:5px;"></i> ${fileName}</span>
        <i class="fas fa-trash" style="color:#94a3b8; cursor:pointer;" onclick="this.parentElement.remove()"></i>
    `;
    container.appendChild(div);
    
    // Reset inputs
    input.value = "";
    nameInput.value = "";
};

window.copierMandant = function() {
    if(document.getElementById('copy_mandant').checked) {
        document.getElementById('f_nom_prenom').value = document.getElementById('civilite_mandant').value + ' ' + document.getElementById('soussigne').value;
        document.getElementById('f_lien').value = document.getElementById('lien').value;
    } else {
        document.getElementById('f_nom_prenom').value = "";
        document.getElementById('f_lien').value = "";
    }
};

window.togglePolice = function() {
    const type = document.getElementById('type_presence_select').value;
    if(type === 'police') {
        document.getElementById('police_fields').classList.remove('hidden');
        document.getElementById('famille_fields').classList.add('hidden');
    } else {
        document.getElementById('police_fields').classList.add('hidden');
        document.getElementById('famille_fields').classList.remove('hidden');
    }
};

window.toggleVol2 = function() {
    const chk = document.getElementById('check_vol2');
    const bloc = document.getElementById('bloc_vol2');
    if(chk && chk.checked) bloc.classList.remove('hidden');
    else bloc.classList.add('hidden');
};
