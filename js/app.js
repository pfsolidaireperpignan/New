/* js/app.js - CONNECTION ET ROUTAGE */
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// 1. RENDRE LES FONCTIONS ACCESSIBLES AU HTML (onclick)
window.chargerBaseClients = DB.chargerBaseClients;
window.chargerDossier = DB.chargerDossier;
window.supprimerDossier = DB.supprimerDossier;
window.viderFormulaire = DB.viderFormulaire;
window.chargerStock = DB.chargerStock; 
window.sauvegarderDossier = DB.sauvegarderDossier; // C'est ici que ça bloquait l'enregistrement !
window.importerClientSelectionne = DB.importerClientSelectionne;

// Fonctions PDF
window.genererPouvoir = PDF.genererPouvoir;
window.genererDeclaration = PDF.genererDeclaration;
window.genererDemandeInhumation = PDF.genererDemandeInhumation;
// ... ajoutez les autres PDF ici si besoin ...

// 2. ROUTAGE ET AFFICHAGE
window.showSection = function(id) {
    document.querySelectorAll('.main-content > div').forEach(div => { 
        if(div.id.startsWith('view-')) div.classList.add('hidden'); 
    });
    const target = document.getElementById('view-' + id);
    if(target) target.classList.remove('hidden');

    // Chargement dynamique selon la page
    if(id === 'base') DB.chargerBaseClients();
    if(id === 'admin') DB.chargerSelectImport(); // IMPORTANT: Charge la liste déroulante !
};

window.toggleSidebar = function() { 
    const sb = document.querySelector('.sidebar'); 
    if(sb) sb.classList.toggle('collapsed'); 
};

window.switchAdminTab = function(tab) {
    document.getElementById('tab-content-identite').classList.add('hidden'); 
    document.getElementById('tab-content-technique').classList.add('hidden');
    document.getElementById('tab-content-' + tab).classList.remove('hidden');
};

// 3. INITIALISATION
onAuthStateChanged(auth, (user) => {
    if(user) { 
        document.getElementById('login-screen').classList.add('hidden'); 
        Utils.chargerLogoBase64(); 
        // Initialisation des listeners manuels si nécessaire
        const btnSave = document.getElementById('btn-save-bdd');
        if(btnSave) btnSave.onclick = DB.sauvegarderDossier;
        
        const btnImport = document.getElementById('btn-import');
        if(btnImport) btnImport.onclick = DB.importerClientSelectionne;
    } else { 
        document.getElementById('login-screen').classList.remove('hidden'); 
    }
});

window.loginFirebase = async function() { try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } catch(e) { alert("Erreur login"); } };
window.logoutFirebase = async function() { await signOut(auth); window.location.reload(); };
