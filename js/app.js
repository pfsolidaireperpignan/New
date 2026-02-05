/* js/app.js - VERSION "FORCE BRUTE" 
   Date: 05/02/2026
   Cette version contient un scanner multi-collections pour trouver les dossiers perdus.
*/

// --- 1. IMPORTS ---
import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
// Import de sécurité pour la base de données (évite l'erreur window.doc)
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// --- 2. EXPOSITION DES FONCTIONS AU HTML ---
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


// --- 3. FONCTION DE CHARGEMENT "INTELLIGENTE" ---
window.chargerDossier = async function(id) {
    try {
        const cleanID = id.trim();
        console.log("🔍 START - Recherche Dossier ID :", cleanID);
        
        // Liste des endroits où chercher (Respecte la casse !)
        const collectionsPossibles = [
            "dossiers", 
            "clients", 
            "Clients", 
            "Base_Clients", 
            "Dossiers"
        ];

        let docSnap = null;
        let collectionTrouvee = "";

        // BOUCLE DE RECHERCHE
        for (const nomCol of collectionsPossibles) {
            // On tente de lire dans cette collection
            const docRef = doc(db, nomCol, cleanID);
            const tempSnap = await getDoc(docRef);
            
            if (tempSnap.exists()) {
                docSnap = tempSnap;
                collectionTrouvee = nomCol;
                console.log(`✅ SUCCÈS : Dossier trouvé dans '${nomCol}'`);
                break; // Stop, on a trouvé !
            } else {
                console.log(`❌ Pas trouvé dans '${nomCol}'...`);
            }
        }

        // SI AUCUN RÉSULTAT APRÈS AVOIR TOUT TESTÉ
        if (!docSnap || !docSnap.exists()) {
            alert(`⚠️ DOSSIER INTROUVABLE.\n\nID: ${cleanID}\nNous avons cherché dans : ${collectionsPossibles.join(', ')}.\n\nIl a probablement été supprimé.`);
            return;
        }

        // --- CHARGEMENT DES DONNÉES ---
        const data = docSnap.data();

        // A. Remplir les champs du formulaire
        for (const [key, value] of Object.entries(data)) {
            const input = document.getElementById(key);
            if (input) {
                if (input.type === 'checkbox') input.checked = value;
                else input.value = value;
            }
        }

        // B. Remplir la GED (Liste des fichiers)
        const container = document.getElementById('liste_pieces_jointes');
        if (container) {
            container.innerHTML = ""; 
            if (data.pieces_jointes && Array.isArray(data.pieces_jointes) && data.pieces_jointes.length > 0) {
                data.pieces_jointes.forEach(nomFichier => {
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

        // C. Transformer le bouton "Enregistrer" en "Modifier"
        const hiddenId = document.getElementById('dossier_id');
        if(hiddenId) hiddenId.value = cleanID;

        const btn = document.getElementById('btn-save-bdd');
        if (btn) {
            btn.innerHTML = `<i class="fas fa-pen"></i> MODIFIER (${collectionTrouvee})`;
            btn.classList.remove('btn-green');
            btn.classList.add('btn-warning'); 
            btn.style.backgroundColor = "#f59e0b"; // Orange
            
            // On force la sauvegarde vers la BONNE collection
            btn.onclick = function() { window.sauvegarderDossier(cleanID, collectionTrouvee); };
        }

        // D. Réactiver les zones cachées (Vol 2, Police, etc.)
        if(window.toggleSections) window.toggleSections();
        if(window.togglePolice) window.togglePolice();
        if(window.toggleVol2) window.toggleVol2();

        // E. Afficher la page Admin
        window.showSection('admin');

    } catch (e) {
        console.error("Erreur critique:", e);
        alert("Erreur technique : " + e.message);
    }
};


// --- 4. LOGIQUE D'INTERFACE (UI) ---

// Gestion des onglets Inhumation / Crémation / Rapatriement
window.toggleSections = function() {
    const select = document.getElementById('prestation');
    if(!select) return;
    const choix = select.value;
    
    // Identifiants des blocs et boutons
    const map = {
        'Inhumation': { bloc: 'bloc_inhumation', btn: 'btn_inhumation' },
        'Crémation': { bloc: 'bloc_cremation', btn: 'btn_cremation' },
        'Rapatriement': { bloc: 'bloc_rapatriement', btn: 'btn_rapatriement' }
    };

    // Tout cacher d'abord
    ['bloc_inhumation', 'bloc_cremation', 'bloc_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    ['btn_inhumation', 'btn_cremation', 'btn_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));

    // Afficher le bon
    if (map[choix]) {
        document.getElementById(map[choix].bloc)?.classList.remove('hidden');
        document.getElementById(map[choix].btn)?.classList.remove('hidden');
    }
};

// Gestion Vol 2
window.toggleVol2 = function() {
    const chk = document.getElementById('check_vol2');
    const bloc = document.getElementById('bloc_vol2');
    if(chk && bloc) {
        if(chk.checked) bloc.classList.remove('hidden');
        else bloc.classList.add('hidden');
    }
};

// Gestion Police vs Famille
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

// Copie Mandant -> Témoin
window.copierMandant = function() {
    const chk = document.getElementById('copy_mandant');
    if(chk && chk.checked) {
        const nom = document.getElementById('soussigne').value;
        const lien = document.getElementById('lien').value;
        if(document.getElementById('f_nom_prenom')) document.getElementById('f_nom_prenom').value = nom;
        if(document.getElementById('f_lien')) document.getElementById('f_lien').value = lien;
    }
};

// Ajout Pièce Jointe (GED)
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

// Navigation Menu
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

// --- 5. INITIALISATION (AUTH) ---
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
