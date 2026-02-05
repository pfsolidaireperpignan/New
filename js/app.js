/* js/app.js - VERSION ULTIME (FIX PAGE BLANCHE + LIMITE TAILLE) */

import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './config.js';
import { doc, getDoc, collection, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import * as Utils from './utils.js';
import * as PDF from './pdf_admin.js';
import * as DB from './db_manager.js';

// --- CONNECTION AU HTML ---
window.chargerBaseClients = DB.chargerBaseClients;
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
// 1. AJOUT FICHIER (AVEC LIMITE STRICTE 500 KO)
// ============================================================
window.ajouterPieceJointe = function() {
    const container = document.getElementById('liste_pieces_jointes');
    const fileInput = document.getElementById('ged_input_file');
    const nameInput = document.getElementById('ged_file_name');

    if (fileInput.files.length === 0) { alert("⚠️ Sélectionnez un fichier."); return; }

    const file = fileInput.files[0];
    
    // --- NOUVELLE LIMITE STRICTE : 500 KO ---
    // (Car 500 Ko deviennent ~700 Ko en base de données. La limite totale est 1000 Ko)
    if (file.size > 500 * 1024) {
        alert("⚠️ FICHIER TROP LOURD !\n\nPour ne pas bloquer la base de données, la limite est de 500 Ko.\nVotre fichier fait " + (file.size/1024).toFixed(0) + " Ko.\n\nVeuillez le compresser (ex: ilovepdf.com) avant de l'ajouter.");
        return;
    }

    const nomDoc = nameInput.value || file.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64String = e.target.result;
        
        // Création immédiate d'un Blob URL pour visualisation locale (sans bug)
        const localUrl = URL.createObjectURL(file);

        if(container.innerText.includes('Aucun')) container.innerHTML = "";

        const div = document.createElement('div');
        div.className = "ged-item"; 
        div.style = "display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
        
        div.setAttribute('data-name', nomDoc);
        div.setAttribute('data-b64', base64String); 

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <i class="fas fa-file-pdf" style="color:#ef4444; font-size:1.6rem;"></i>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:700; color:#334155; font-size:0.95rem;">${nomDoc}</span>
                    <span style="font-size:0.75rem; color:#10b981; font-weight:600;">Prêt (${(file.size/1024).toFixed(0)} Ko)</span>
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <a href="${localUrl}" target="_blank" class="btn-icon" style="background:#3b82f6; color:white; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px; text-decoration:none;" title="Voir">
                    <i class="fas fa-eye"></i>
                </a>
                <button onclick="this.closest('.ged-item').remove()" class="btn-icon" style="background:#ef4444; color:white; width:34px; height:34px; border:none; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);

        fileInput.value = ""; 
        nameInput.value = "";
    };
    reader.readAsDataURL(file);
};


// ============================================================
// 2. SAUVEGARDE
// ============================================================
window.sauvegarderDossier = async function() {
    const btn = document.getElementById('btn-save-bdd');
    if(btn) btn.innerHTML = "Sauvegarde...";
    
    try {
        let gedList = [];
        document.querySelectorAll('#liste_pieces_jointes .ged-item').forEach(div => {
            const name = div.getAttribute('data-name');
            const b64 = div.getAttribute('data-b64');
            if(name && b64) gedList.push({ nom: name, file: b64 });
        });

        const getVal = (id) => document.getElementById(id)?.value || "";
        
        const data = {
            date_modification: new Date().toISOString(),
            defunt: {
                civility: getVal('civilite_defunt'), nom: getVal('nom'), prenom: getVal('prenom'), nom_jeune_fille: getVal('nom_jeune_fille'),
                date_deces: getVal('date_deces'), lieu_deces: getVal('lieu_deces'), date_naiss: getVal('date_naiss'), lieu_naiss: getVal('lieu_naiss'),
                adresse: getVal('adresse_fr'), pere: getVal('pere'), mere: getVal('mere'), situation: getVal('matrimoniale'),
                conjoint: getVal('conjoint'), profession: getVal('profession_libelle')
            },
            mandant: { civility: getVal('civilite_mandant'), nom: getVal('soussigne'), lien: getVal('lien'), adresse: getVal('demeurant') },
            technique: {
                type_operation: document.getElementById('prestation').value, lieu_mise_biere: getVal('lieu_mise_biere'), date_fermeture: getVal('date_fermeture'),
                cimetiere: getVal('cimetiere_nom'), crematorium: getVal('crematorium_nom'), date_ceremonie: getVal('date_inhumation') || getVal('date_cremation'),
                heure_ceremonie: getVal('heure_inhumation') || getVal('heure_cremation'), num_concession: getVal('num_concession'), faita: getVal('faita'),
                date_signature: getVal('dateSignature'), police_nom: getVal('p_nom_grade'), police_commissariat: getVal('p_commissariat')
            },
            transport: { av_dep: getVal('av_lieu_depart'), av_arr: getVal('av_lieu_arrivee'), ap_dep: getVal('ap_lieu_depart'), ap_arr: getVal('ap_lieu_arrivee'), rap_pays: getVal('rap_pays'), rap_ville: getVal('rap_ville'), rap_lta: getVal('rap_lta') },
            ged: gedList 
        };

        const id = document.getElementById('dossier_id').value;
        
        if(id) { 
            await updateDoc(doc(db, "dossiers_admin", id), data); 
            alert("✅ Dossier sauvegardé !"); 
        } else { 
            data.date_creation = new Date().toISOString(); 
            const ref = await addDoc(collection(db, "dossiers_admin"), data); 
            document.getElementById('dossier_id').value = ref.id; 
            alert("✅ Dossier créé !"); 
        }
        
        if(window.chargerBaseClients) window.chargerBaseClients();

    } catch(e) { 
        console.error(e);
        // Message d'erreur plus clair pour la taille
        if(e.message.includes("size")) {
            alert("❌ ERREUR TAILLE : Le dossier est trop lourd pour la base de données !\nSupprimez la pièce jointe et essayez avec une plus petite.");
        } else {
            alert("Erreur Sauvegarde : " + e.message); 
        }
    }
    
    if(btn) btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
};


// ============================================================
// 3. CHARGEMENT AVEC CORRECTIF "PAGE BLANCHE" (Blob)
// ============================================================
window.chargerDossier = async function(id) {
    try {
        console.log("📂 Chargement...", id);
        const docRef = doc(db, "dossiers_admin", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) { alert("❌ Dossier introuvable."); return; }

        const data = docSnap.data();
        const set = (htmlId, val) => { const el = document.getElementById(htmlId); if(el) el.value = val || ''; };

        // Remplissage Champs...
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

        // --- AFFICHAGE GED ET CONVERSION BLOB (Solution Page Blanche) ---
        const container = document.getElementById('liste_pieces_jointes');
        const rawGed = data.ged || data.pieces_jointes || [];
        
        if (container) {
            container.innerHTML = ""; 
            if (Array.isArray(rawGed) && rawGed.length > 0) {
                // On utilise une boucle async pour pouvoir faire la conversion
                for (const item of rawGed) {
                    let nom = item; 
                    let lien = "#";
                    let isBinary = false;

                    if (typeof item === 'object' && item.file) {
                        nom = item.nom;
                        isBinary = true;
                        
                        // MAGIE : On transforme le texte Base64 en un "vrai" fichier pour le navigateur
                        try {
                            const res = await fetch(item.file);
                            const blob = await res.blob();
                            lien = URL.createObjectURL(blob); // Lien valide pour Chrome !
                        } catch(err) {
                            console.error("Erreur conversion PDF", err);
                            lien = item.file; // Fallback au cas où
                        }
                    }

                    if(typeof nom === 'string' && nom.includes("Enregistré")) continue;

                    const div = document.createElement('div');
                    div.className = "ged-item"; 
                    if(isBinary) {
                        div.setAttribute('data-name', nom);
                        div.setAttribute('data-b64', item.file); // On garde l'original pour la resauvegarde
                    }

                    div.style = "display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
                    
                    const btnEye = isBinary 
                        ? `<a href="${lien}" target="_blank" class="btn-icon" style="background:#3b82f6; color:white; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px; text-decoration:none;" title="Voir"><i class="fas fa-eye"></i></a>`
                        : `<div style="background:#e2e8f0; color:#94a3b8; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:4px; cursor:not-allowed;"><i class="fas fa-eye-slash"></i></div>`;

                    div.innerHTML = `
                        <div style="display:flex; align-items:center; gap:12px;">
                            <i class="fas fa-file-pdf" style="color:#ef4444; font-size:1.6rem;"></i>
                            <div style="display:flex; flex-direction:column;">
                                <span style="font-weight:700; color:#334155; font-size:0.95rem;">${nom}</span>
                                <span style="font-size:0.75rem; color:${isBinary ? '#10b981' : '#64748b'}; font-weight:600;">${isBinary ? 'Stocké ✅' : 'Non stocké'}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            ${btnEye}
                            <button onclick="this.closest('.ged-item').remove()" class="btn-icon" style="background:#ef4444; color:white; width:34px; height:34px; border:none; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                    container.appendChild(div);
                }
            } else {
                container.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">Aucun document joint.</div>';
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
// 4. UI
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
    if(sb) sb.classList.toggle('collapsed');
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
