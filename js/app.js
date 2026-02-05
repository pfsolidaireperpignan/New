/* js/app.js - VERSION FINALE (GED VISUELLE + CORRECTIF DOSSIER) */

// 1. IMPORTS
import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// 2. CONNECTION AU HTML
window.chargerBaseClients = DB.chargerBaseClients;
window.sauvegarderDossier = DB.sauvegarderDossier;
window.supprimerDossier = DB.supprimerDossier;
window.viderFormulaire = DB.viderFormulaire;
window.chargerStock = DB.chargerStock;
window.ajouterArticleStock = DB.ajouterArticle;
window.supprimerArticle = DB.supprimerArticle;
window.importerClientSelectionne = DB.importerClientSelectionne;
window.chargerSelectImport = DB.chargerSelectImport;

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
// 3. FONCTION GED AMÉLIORÉE (AVEC L'OEIL)
// ============================================================
window.ajouterPieceJointe = function() {
    const container = document.getElementById('liste_pieces_jointes');
    const fileInput = document.getElementById('ged_input_file');
    const nameInput = document.getElementById('ged_file_name');

    // Vérification
    if (fileInput.files.length === 0) { 
        alert("⚠️ Veuillez sélectionner un fichier (PDF ou Image) d'abord."); 
        return; 
    }

    const file = fileInput.files[0];
    // On prend le nom saisi ou le nom du fichier
    const nomDoc = nameInput.value || file.name;
    
    // CRÉATION DU LIEN DE VISUALISATION (C'est ça qui manquait !)
    const fileURL = URL.createObjectURL(file);

    // Nettoyage du message "Aucun document"
    if(container.innerText.includes('Aucun document')) container.innerHTML = "";

    const div = document.createElement('div');
    div.style = "background:white; padding:8px; margin-bottom:5px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; border-radius:4px;";
    
    div.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
            <span style="font-weight:600; color:#334155;">📄 ${nomDoc}</span>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
            <a href="${fileURL}" target="_blank" style="color:#3b82f6; cursor:pointer; font-size:1.1rem;" title="Voir le document">
                <i class="fas fa-eye"></i>
            </a>
            <i class="fas fa-trash-alt" style="color:#ef4444; cursor:pointer;" onclick="this.parentElement.parentElement.remove()"></i>
        </div>
    `;
    
    container.appendChild(div);

    // Reset des champs
    fileInput.value = ""; 
    nameInput.value = "";
};


// ============================================================
// 4. CHARGEMENT DOSSIER (Optimisé)
// ============================================================
window.chargerDossier = async function(id) {
    try {
        console.log("📂 Chargement...", id);
        const docRef = doc(db, "dossiers_admin", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) { alert("❌ Dossier introuvable."); return; }

        const data = docSnap.data();
        const set = (htmlId, val) => { const el = document.getElementById(htmlId); if(el) el.value = val || ''; };

        // Remplissage...
        if (data.defunt) {
            set('civilite_defunt', data.defunt.civility); set('nom', data.defunt.nom); set('prenom', data.defunt.prenom);
            set('nom_jeune_fille', data.defunt.nom_jeune_fille); set('date_deces', data.defunt.date_deces);
            set('lieu_deces', data.defunt.lieu_deces); set('date_naiss', data.defunt.date_naiss);
            set('lieu_naiss', data.defunt.lieu_naiss); set('adresse_fr', data.defunt.adresse);
            set('pere', data.defunt.pere); set('mere', data.defunt.mere);
            set('matrimoniale', data.defunt.situation); set('conjoint', data.defunt.conjoint);
            set('profession_libelle', data.defunt.profession);
        }
        if (data.mandant) {
            set('civilite_mandant', data.mandant.civility); set('soussigne', data.mandant.nom);
            set('lien', data.mandant.lien); set('demeurant', data.mandant.adresse);
        }
        if (data.technique) {
            const op = data.technique.type_operation || 'Inhumation';
            set('prestation', op); set('lieu_mise_biere', data.technique.lieu_mise_biere);
            set('date_fermeture', data.technique.date_fermeture); set('cimetiere_nom', data.technique.cimetiere);
            set('crematorium_nom', data.technique.crematorium); set('num_concession', data.technique.num_concession);
            set('faita', data.technique.faita); set('dateSignature', data.technique.date_signature);
            set('p_nom_grade', data.technique.police_nom); set('p_commissariat', data.technique.police_commissariat);
            if (op === 'Inhumation') { set('date_inhumation', data.technique.date_ceremonie); set('heure_inhumation', data.technique.heure_ceremonie); }
            else if (op === 'Crémation') { set('date_cremation', data.technique.date_ceremonie); set('heure_cremation', data.technique.heure_ceremonie); }
        }
        if (data.transport) {
            set('av_lieu_depart', data.transport.av_dep); set('av_lieu_arrivee', data.transport.av_arr);
            set('ap_lieu_depart', data.transport.ap_dep); set('ap_lieu_arrivee', data.transport.ap_arr);
            set('rap_pays', data.transport.rap_pays); set('rap_ville', data.transport.rap_ville); set('rap_lta', data.transport.rap_lta);
        }

        // --- AFFICHAGE GED EXISTANTE ---
        // On nettoie les "Enregistré" qui traînent dans le nom
        const gedList = (data.ged || data.pieces_jointes || []).filter(n => !n.includes("Enregistré ✅"));
        
        const container = document.getElementById('liste_pieces_jointes');
        if (container) {
            container.innerHTML = ""; 
            if (Array.isArray(gedList) && gedList.length > 0) {
                gedList.forEach(nomFichier => {
                    const div = document.createElement('div');
                    div.style = "background:white; padding:8px; margin-bottom:5px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; border-radius:4px;";
                    // Pas d'œil ici car fichier non stocké, juste le nom
                    div.innerHTML = `
                        <span style="font-weight:600; color:#334155;">📄 ${nomFichier}</span>
                        <small style="font-size:0.8rem; color:green; font-weight:bold;">Enregistré ✅</small>
                        <i class="fas fa-trash-alt" style="color:#ef4444; cursor:pointer; margin-left:10px;" onclick="this.parentElement.remove()"></i>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<div style="color:#94a3b8; font-style:italic;">Aucun document joint.</div>';
            }
        }

        const hiddenId = document.getElementById('dossier_id');
        if(hiddenId) hiddenId.value = id;
        const btn = document.getElementById('btn-save-bdd');
        if (btn) {
            btn.innerHTML = `<i class="fas fa-pen"></i> MODIFIER LE DOSSIER`;
            btn.classList.remove('btn-green'); btn.classList.add('btn-warning'); 
            btn.style.backgroundColor = "#f59e0b"; 
            btn.onclick = function() { window.sauvegarderDossier(); };
        }

        if(window.toggleSections) window.toggleSections();
        if(window.togglePolice) window.togglePolice();
        if(window.toggleVol2) window.toggleVol2();
        window.showSection('admin');

    } catch (e) { console.error(e); alert("Erreur : " + e.message); }
};

// ============================================================
// 5. FONCTIONS UI
// ============================================================
window.toggleSections = function() {
    const select = document.getElementById('prestation');
    if(!select) return;
    const choix = select.value;
    const map = {
        'Inhumation': { bloc: 'bloc_inhumation', btn: 'btn_inhumation' },
        'Crémation': { bloc: 'bloc_cremation', btn: 'btn_cremation' },
        'Rapatriement': { bloc: 'bloc_rapatriement', btn: 'btn_rapatriement' }
    };
    ['bloc_inhumation', 'bloc_cremation', 'bloc_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    ['btn_inhumation', 'btn_cremation', 'btn_rapatriement'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
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
        setInterval(() => {
            const now = new Date();
            if(document.getElementById('header-time')) document.getElementById('header-time').innerText = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            if(document.getElementById('header-date')) document.getElementById('header-date').innerText = now.toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        }, 1000);
    } else {
        document.getElementById('login-screen')?.classList.remove('hidden');
    }
});
