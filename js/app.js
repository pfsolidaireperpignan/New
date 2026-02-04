/* js/app.js - Hub Central */
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import * as Utils from './utils.js';
// Si ce fichier n'existe pas, dites-le moi :
import * as PDF from './pdf_admin.js'; 
import * as DB from './db_manager.js';

// --- 1. EXPOSER LES FONCTIONS AU HTML ---
// Permet d'utiliser onclick="window.genererPouvoir()" dans le HTML
window.genererPouvoir = PDF.genererPouvoir || function(){ alert("Fonction PDF manquante"); };
window.genererDemandeTransport = PDF.genererDemandeTransport || function(){ alert("Fonction PDF manquante"); };
window.genererDemandeCremation = PDF.genererDemandeCremation || function(){ alert("Fonction PDF manquante"); };
window.genererDemandeRapatriement = PDF.genererDemandeRapatriement || function(){ alert("Fonction PDF manquante"); };
window.genererDemandeOuverture = PDF.genererDemandeOuverture || function(){ alert("Fonction PDF manquante"); };
window.genererSoins = PDF.genererSoins || function(){ alert("Fonction PDF manquante"); };
window.genererChambreFuneraire = PDF.genererChambreFuneraire || function(){ alert("Fonction PDF manquante"); };

// Fonctions Base de Données
window.chargerBaseClients = DB.chargerBaseClients;
window.chargerDossier = DB.chargerDossier;
window.sauvegarderDossier = DB.sauvegarderDossier;
window.supprimerDossier = DB.supprimerDossier;

// Fonctions Stock
window.chargerStock = DB.chargerStock;
window.ajouterArticleStock = DB.ajouterArticle;
window.supprimerArticle = DB.supprimerArticle;

// --- 2. GESTION UI (Navigation & Menu) ---
window.showSection = function(id) {
    // Cache toutes les vues
    ['home', 'admin', 'base', 'stock'].forEach(v => {
        const el = document.getElementById('view-' + v);
        if(el) el.classList.add('hidden');
    });
    
    // Affiche la vue demandée
    const target = document.getElementById('view-' + id);
    if(target) target.classList.remove('hidden');

    // Chargement dynamique des données
    if(id === 'base') DB.chargerBaseClients();
    if(id === 'stock') DB.chargerStock();
    
    // Fermer le menu sur mobile après clic
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
        // Mode Mobile
        sb.classList.toggle('mobile-open');
        if(overlay) overlay.style.display = sb.classList.contains('mobile-open') ? 'block' : 'none';
    } else {
        // Mode PC
        sb.classList.toggle('collapsed');
        // Gestion visuelle des textes
        const isCollapsed = sb.classList.contains('collapsed');
        sb.querySelectorAll('.brand-text, .nav-text').forEach(span => {
            span.style.display = isCollapsed ? 'none' : 'inline';
        });
    }
};

// Gestion des onglets dans la partie Admin (Défunt / Mandataire / Etc)
window.switchTab = function(tab) {
    // Masquer tous les contenus d'onglets
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // Afficher le bon
    const content = document.getElementById('tab-content-' + tab);
    if(content) content.classList.remove('hidden');
    
    const btn = document.getElementById('tab-btn-' + tab);
    if(btn) btn.classList.add('active');
};

// --- 3. AUTHENTIFICATION ---
window.loginFirebase = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch(e) {
        alert("Erreur de connexion : " + e.message);
    }
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
        // Utilisateur connecté
        document.getElementById('login-screen').classList.add('hidden');
        Utils.chargerLogoBase64();
        DB.chargerBaseClients(); // On charge la liste par défaut
        
        // Gestion de l'horloge
        setInterval(() => {
            const now = new Date();
            const timeEl = document.getElementById('header-time');
            const dateEl = document.getElementById('header-date');
            
            if(timeEl) timeEl.innerText = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            if(dateEl) dateEl.innerText = now.toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        }, 1000);
        
    } else {
        // Utilisateur déconnecté
        document.getElementById('login-screen').classList.remove('hidden');
    }
});