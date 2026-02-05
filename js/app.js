/* js/app.js - CONNECTION GLOBALE */
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// 1. RENDRE LES FONCTIONS GLOBALES (CRUCIAL POUR HTML)
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
window.genererDemandeCremation = PDF.genererDemandeCremation;
// ... (ajoutez les autres exports PDF si besoin)

// 2. ROUTAGE ET AFFICHAGE
window.showSection = function(id) {
    document.querySelectorAll('.main-content > div').forEach(div => { 
        if(div.id.startsWith('view-')) div.classList.add('hidden'); 
    });
    const target = document.getElementById('view-' + id);
    if(target) target.classList.remove('hidden');

    if(id === 'base') DB.chargerBaseClients();
    if(id === 'admin') DB.chargerSelectImport(); // Charge la liste import !
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

// 3. INITIALISATION (Débloque le chargement infini)
onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('app-loader');
    if(loader) loader.style.display = 'none'; // CACHE LE LOADER QUOI QU'IL ARRIVE
    
    if(user) { 
        document.getElementById('login-screen')?.classList.add('hidden'); 
        Utils.chargerLogoBase64(); 
    } else { 
        document.getElementById('login-screen')?.classList.remove('hidden'); 
    }
});

window.loginFirebase = async function() { try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } catch(e) { alert("Erreur login"); } };
window.logoutFirebase = async function() { await signOut(auth); window.location.reload(); };
