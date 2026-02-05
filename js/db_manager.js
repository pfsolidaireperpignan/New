/* js/db_manager.js - VERSION COMPLÈTE (Vols, GED, Transports) */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

// Cache pour l'import facturation
let importCache = [];

// --- 1. GESTION DOSSIERS ADMIN ---

export async function chargerBaseClients() {
    const tbody = document.getElementById('clients-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Chargement...</td></tr>';
    
    try {
        const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(50));
        const snapshot = await getDocs(q);
        
        tbody.innerHTML = "";
        if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Aucun dossier.</td></tr>'; return; }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.date_creation ? new Date(data.date_creation).toLocaleDateString() : '-'}</td>
                <td><strong>${data.defunt?.nom || '?'}</strong></td>
                <td>${data.mandant?.nom || '?'}</td>
                <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${data.technique?.type_operation || 'Dossier'}</span></td>
                <td style="text-align:center;">
                    <button class="btn-icon" onclick="window.chargerDossier('${docSnap.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" onclick="window.supprimerDossier('${docSnap.id}')" style="color:red;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center">Erreur de chargement.</td></tr>'; }
}

export async function chargerDossier(id) {
    try {
        const docRef = doc(db, "dossiers_admin", id);
        const docSnap = await getDoc(docRef);
        if(docSnap.exists()) {
            const data = docSnap.data();
            window.showSection('admin');
            
            // 1. On vide d'abord le formulaire
            window.viderFormulaire();
            document.getElementById('dossier_id').value = id;
            
            // 2. Identité
            if(data.defunt) {
                setVal('civilite_defunt', data.defunt.civility);
                setVal('nom', data.defunt.nom);
                setVal('prenom', data.defunt.prenom);
                setVal('nom_jeune_fille', data.defunt.nom_jeune_fille);
                setVal('date_deces', data.defunt.date_deces);
                setVal('lieu_deces', data.defunt.lieu_deces);
                setVal('heure_deces', data.defunt.heure_deces);
                setVal('date_naiss', data.defunt.date_naiss);
                setVal('lieu_naiss', data.defunt.lieu_naiss);
                setVal('adresse_fr', data.defunt.adresse);
                setVal('nationalite', data.defunt.nationalite);
                setVal('pere', data.defunt.pere);
                setVal('mere', data.defunt.mere);
                setVal('matrimoniale', data.defunt.situation);
                setVal('conjoint', data.defunt.conjoint);
                setVal('profession_libelle', data.defunt.profession);
            }
            if(data.mandant) {
                setVal('civilite_mandant', data.mandant.civility);
                setVal('soussigne', data.mandant.nom);
                setVal('lien', data.mandant.lien);
                setVal('demeurant', data.mandant.adresse);
            }
            
            // 3. Technique & Police
            if(data.technique) {
                setVal('prestation', data.technique.type_operation);
                setVal('lieu_mise_biere', data.technique.lieu_mise_biere);
                setVal('date_fermeture', data.technique.date_fermeture);
                setVal('immatriculation', data.technique.vehicule);
                setVal('cimetiere_nom', data.technique.cimetiere);
                setVal('crematorium_nom', data.technique.crematorium);
                setVal('date_inhumation', data.technique.date_ceremonie); // ou date_cremation selon cas
                setVal('date_cremation', data.technique.date_ceremonie);
                setVal('heure_inhumation', data.technique.heure_ceremonie);
                setVal('heure_cremation', data.technique.heure_ceremonie);
                setVal('num_concession', data.technique.num_concession);
                setVal('titulaire_concession', data.technique.titulaire_concession);
                setVal('faita', data.technique.faita);
                setVal('dateSignature', data.technique.date_signature);
                
                // Police / Famille
                setVal('type_presence_select', data.technique.type_presence || 'famille');
                setVal('p_nom_grade', data.technique.police_nom);
                setVal('p_commissariat', data.technique.police_commissariat);
                setVal('f_nom_prenom', data.technique.temoin_nom);
                setVal('f_lien', data.technique.temoin_lien);
            }

            // 4. Transport & Rapatriement (Vols)
            if(data.transport) {
                // Avant MEB
                setVal('av_lieu_depart', data.transport.av_dep_lieu);
                setVal('av_lieu_arrivee', data.transport.av_arr_lieu);
                setVal('av_date_dep', data.transport.av_dep_date);
                setVal('av_heure_dep', data.transport.av_dep_heure);
                setVal('av_date_arr', data.transport.av_arr_date);
                setVal('av_heure_arr', data.transport.av_arr_heure);
                
                // Après MEB
                setVal('ap_lieu_depart', data.transport.ap_dep_lieu);
                setVal('ap_lieu_arrivee', data.transport.ap_arr_lieu);
                setVal('ap_date_dep', data.transport.ap_dep_date);
                setVal('ap_heure_dep', data.transport.ap_dep_heure);
                setVal('ap_date_arr', data.transport.ap_arr_date);
                setVal('ap_heure_arr', data.transport.ap_arr_heure);

                // Rapatriement
                setVal('rap_pays', data.transport.rap_pays);
                setVal('rap_ville', data.transport.rap_ville);
                setVal('rap_lta', data.transport.rap_lta);
                setVal('vol1_num', data.transport.vol1_num);
                setVal('vol1_dep_aero', data.transport.vol1_dep_aero);
                setVal('vol1_arr_aero', data.transport.vol1_arr_aero);
                setVal('vol1_dep_time', data.transport.vol1_dep_time);
                setVal('vol1_arr_time', data.transport.vol1_arr_time);
                
                setVal('vol2_num', data.transport.vol2_num);
                setVal('vol2_dep_aero', data.transport.vol2_dep_aero);
                setVal('vol2_arr_aero', data.transport.vol2_arr_aero);
                setVal('vol2_dep_time', data.transport.vol2_dep_time);
                setVal('vol2_arr_time', data.transport.vol2_arr_time);
                
                if(document.getElementById('check_vol2')) {
                    document.getElementById('check_vol2').checked = !!data.transport.vol2_num;
                }
            }

            // 5. GED (Pièces Jointes)
            const gedDiv = document.getElementById('liste_pieces_jointes');
            if(gedDiv && data.ged && Array.isArray(data.ged)) {
                gedDiv.innerHTML = "";
                data.ged.forEach(docName => {
                    gedDiv.innerHTML += `
                        <div style="background:white; padding:5px 10px; border-radius:4px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                            <span><i class="fas fa-file-pdf" style="color:#ef4444; margin-right:5px;"></i> ${docName}</span>
                            <i class="fas fa-trash" style="color:#94a3b8; cursor:pointer;" onclick="this.parentElement.remove()"></i>
                        </div>`;
                });
            }

            // Mise à jour visuelle des blocs
            if(window.toggleSections) window.toggleSections();
            if(window.togglePolice) window.togglePolice();
            if(window.toggleVol2) window.toggleVol2();

        }
    } catch(e) { console.error(e); alert("Erreur chargement dossier: " + e.message); }
}

export async function sauvegarderDossier() {
    const btn = document.getElementById('btn-save-bdd');
    if(btn) btn.innerHTML = "Sauvegarde...";
    
    const id = document.getElementById('dossier_id').value;

    // Récupération de la liste GED (Noms des fichiers uniquement)
    let gedList = [];
    document.querySelectorAll('#liste_pieces_jointes div span').forEach(span => {
        gedList.push(span.innerText.trim());
    });

    const data = {
        date_modification: new Date().toISOString(),
        defunt: {
            civility: getVal('civilite_defunt'),
            nom: getVal('nom'),
            prenom: getVal('prenom'),
            nom_jeune_fille: getVal('nom_jeune_fille'),
            date_deces: getVal('date_deces'),
            lieu_deces: getVal('lieu_deces'),
            heure_deces: getVal('heure_deces'),
            date_naiss: getVal('date_naiss'),
            lieu_naiss: getVal('lieu_naiss'),
            adresse: getVal('adresse_fr'),
            nationalite: getVal('nationalite'),
            pere: getVal('pere'),
            mere: getVal('mere'),
            situation: getVal('matrimoniale'),
            conjoint: getVal('conjoint'),
            profession: getVal('profession_libelle')
        },
        mandant: {
            civility: getVal('civilite_mandant'),
            nom: getVal('soussigne'),
            lien: getVal('lien'),
            adresse: getVal('demeurant')
        },
        technique: {
            type_operation: document.getElementById('prestation').value,
            lieu_mise_biere: getVal('lieu_mise_biere'),
            date_fermeture: getVal('date_fermeture'),
            vehicule: getVal('immatriculation'),
            cimetiere: getVal('cimetiere_nom'),
            crematorium: getVal('crematorium_nom'),
            date_ceremonie: getVal('date_inhumation') || getVal('date_cremation'),
            heure_ceremonie: getVal('heure_inhumation') || getVal('heure_cremation'),
            num_concession: getVal('num_concession'),
            titulaire_concession: getVal('titulaire_concession'),
            faita: getVal('faita'),
            date_signature: getVal('dateSignature'),
            type_presence: document.getElementById('type_presence_select').value,
            police_nom: getVal('p_nom_grade'),
            police_commissariat: getVal('p_commissariat'),
            temoin_nom: getVal('f_nom_prenom'),
            temoin_lien: getVal('f_lien')
        },
        transport: {
            av_dep_lieu: getVal('av_lieu_depart'),
            av_arr_lieu: getVal('av_lieu_arrivee'),
            av_dep_date: getVal('av_date_dep'),
            av_dep_heure: getVal('av_heure_dep'),
            av_arr_date: getVal('av_date_arr'),
            av_arr_heure: getVal('av_heure_arr'),
            ap_dep_lieu: getVal('ap_lieu_depart'),
            ap_arr_lieu: getVal('ap_lieu_arrivee'),
            ap_dep_date: getVal('ap_date_dep'),
            ap_dep_heure: getVal('ap_heure_dep'),
            ap_arr_date: getVal('ap_date_arr'),
            ap_arr_heure: getVal('ap_heure_arr'),
            rap_pays: getVal('rap_pays'),
            rap_ville: getVal('rap_ville'),
            rap_lta: getVal('rap_lta'),
            vol1_num: getVal('vol1_num'),
            vol1_dep_aero: getVal('vol1_dep_aero'),
            vol1_arr_aero: getVal('vol1_arr_aero'),
            vol1_dep_time: getVal('vol1_dep_time'),
            vol1_arr_time: getVal('vol1_arr_time'),
            vol2_num: getVal('vol2_num'),
            vol2_dep_aero: getVal('vol2_dep_aero'),
            vol2_arr_aero: getVal('vol2_arr_aero'),
            vol2_dep_time: getVal('vol2_dep_time'),
            vol2_arr_time: getVal('vol2_arr_time')
        },
        ged: gedList
    };

    try {
        if (id) {
            await updateDoc(doc(db, "dossiers_admin", id), data);
            alert("Dossier mis à jour avec succès !");
        } else {
            data.date_creation = new Date().toISOString();
            const docRef = await addDoc(collection(db, "dossiers_admin"), data);
            document.getElementById('dossier_id').value = docRef.id;
            alert("Nouveau dossier créé !");
        }
        if(btn) btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
        chargerBaseClients();
    } catch(e) { 
        console.error(e); 
        alert("Erreur sauvegarde: " + e.message); 
        if(btn) btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
    }
}

export async function supprimerDossier(id) {
    if(confirm("Supprimer ce dossier administrative ?")) { 
        await deleteDoc(doc(db, "dossiers_admin", id)); 
        chargerBaseClients(); 
    }
}

export function viderFormulaire() {
    document.getElementById('dossier_id').value = "";
    document.querySelectorAll('#view-admin input').forEach(i => i.value = "");
    document.getElementById('faita').value = "PERPIGNAN";
    document.getElementById('nationalite').value = "Française";
    document.getElementById('prestation').value = "Inhumation";
    document.getElementById('immatriculation').value = "DA-081-ZQ";
    document.getElementById('liste_pieces_jointes').innerHTML = '<div style="color:#94a3b8; font-style:italic;">Aucun document joint.</div>';
    
    if(window.toggleSections) window.toggleSections();
}

// --- 2. IMPORT DEPUIS FACTURATION ---

export async function chargerSelectImport() {
    const select = document.getElementById('select-import-client');
    if(!select) return;
    
    select.innerHTML = '<option>Chargement...</option>';
    importCache = [];

    try {
        const q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"), limit(20));
        const snaps = await getDocs(q);
        
        select.innerHTML = '<option value="">Choisir un client...</option>';
        
        snaps.forEach(doc => {
            const d = doc.data();
            importCache.push(d);
            const label = `${d.info?.type} ${d.info?.numero} - ${d.client?.nom} (Défunt: ${d.defunt?.nom})`;
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.innerText = label;
            select.appendChild(opt);
        });
    } catch(e) {
        console.error(e);
        select.innerHTML = '<option>Erreur chargement</option>';
    }
}

export function importerClientSelectionne() {
    const select = document.getElementById('select-import-client');
    const id = select.value;
    if(!id) return alert("Veuillez choisir un client dans la liste.");
    
    const data = importCache.find(d => select.options[select.selectedIndex].value === id);
    
    if(data) {
        if(data.client) {
            setVal('civilite_mandant', data.client.civility);
            setVal('soussigne', data.client.nom);
            setVal('demeurant', data.client.adresse);
        }
        if(data.defunt) {
            setVal('civilite_defunt', data.defunt.civility);
            setVal('nom', data.defunt.nom);
            setVal('date_naiss', data.defunt.date_naiss);
            setVal('date_deces', data.defunt.date_deces);
        }
        alert("Identité importée ! Note : Les vols ne sont pas sur la facture, merci de les saisir.");
    }
}

// --- 3. STOCK ---
export async function chargerStock() {
    const tbody = document.getElementById('stock-table-body');
    if(!tbody) return;
    const q = query(collection(db, "stock_articles"), orderBy("nom"));
    const snap = await getDocs(q);
    tbody.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><b>${d.nom}</b></td><td>${d.categorie}</td><td>${d.qte}</td><td><button onclick="window.supprimerArticle('${doc.id}')" style="color:red;border:none;background:none;"><i class="fas fa-trash"></i></button></td>`;
        tbody.appendChild(tr);
    });
}
export async function ajouterArticle() {
    const nom = document.getElementById('st_nom').value;
    const cat = document.getElementById('st_cat').value;
    const qte = document.getElementById('st_qte').value;
    if(nom) { await addDoc(collection(db, "stock_articles"), {nom, categorie:cat, qte:parseInt(qte)}); chargerStock(); document.getElementById('form-stock').classList.add('hidden'); }
}
export async function supprimerArticle(id) {
    if(confirm("Supprimer ?")) { await deleteDoc(doc(db, "stock_articles", id)); chargerStock(); }
}
