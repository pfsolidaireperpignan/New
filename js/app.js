/* js/app.js - CONNECTION */
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// EXPOSER LES FONCTIONS GLOBALES (Pour les onclick HTML)
window.chargerBaseClients = DB.chargerBaseClients;
window.chargerDossier = DB.chargerDossier;
window.supprimerDossier = DB.supprimerDossier;
window.viderFormulaire = DB.viderFormulaire;
window.chargerStock = DB.chargerStock; 
// IMPORTANT : Exposer la sauvegarde pour l'Admin
window.sauvegarderDossier = DB.sauvegarderDossier;
window.genererPouvoir = PDF.genererPouvoir; // etc pour les autres PDF...

window.showSection = function(id) {
    document.querySelectorAll('.main-content > div').forEach(div => { if(div.id.startsWith('view-')) div.classList.add('hidden'); });
    const target = document.getElementById('view-' + id);
    if(target) target.classList.remove('hidden');
    if(id === 'base') DB.chargerBaseClients();
    if(id === 'admin') DB.chargerSelectImport();
};

window.toggleSidebar = function() { const sb = document.querySelector('.sidebar'); if(sb) sb.classList.toggle('collapsed'); };
window.switchAdminTab = function(tab) {
    document.getElementById('tab-content-identite').classList.add('hidden'); document.getElementById('tab-content-technique').classList.add('hidden');
    document.getElementById('tab-content-' + tab).classList.remove('hidden');
};

// LISTENERS MANUELS (Sécurité si onclick ne marche pas)
document.addEventListener('DOMContentLoaded', () => {
    const btnSave = document.getElementById('btn-save-bdd');
    if(btnSave) btnSave.addEventListener('click', DB.sauvegarderDossier); // Double sécurité
});

onAuthStateChanged(auth, (user) => {
    if(user) { document.getElementById('login-screen').classList.add('hidden'); Utils.chargerLogoBase64(); } 
    else { document.getElementById('login-screen').classList.remove('hidden'); }
});

window.loginFirebase = async function() { try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } catch(e) { alert("Erreur login"); } };
window.logoutFirebase = async function() { await signOut(auth); window.location.reload(); };
