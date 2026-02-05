/* js/db_manager.js - VERSION CORRIGÉE (GED + VITESSE) */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

// --- CLIENTS (Optimisé pour la vitesse) ---
export async function chargerBaseClients() {
    const tbody = document.getElementById('clients-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Chargement rapide...</td></tr>';
    
    try {
        // CORRECTION VITESSE : On demande seulement les 50 derniers dossiers, triés par date
        const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(50));
        const snapshot = await getDocs(q);
        
        tbody.innerHTML = "";
        if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Aucun dossier trouvé.</td></tr>'; return; }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            
            // Sécurité si les champs sont vides
            const dateAffiche = data.date_creation ? new Date(data.date_creation).toLocaleDateString() : '-';
            const nomDefunt = data.defunt?.nom || '?';
            const nomMandant = data.mandant?.nom || '?';
            const operation = data.technique?.type_operation || 'Dossier';

            tr.innerHTML = `
                <td>${dateAffiche}</td>
                <td><strong>${nomDefunt}</strong></td>
                <td>${nomMandant}</td>
                <td><span class="badge badge-blue">${operation}</span></td>
                <td style="text-align:center;">
                    <button class="btn-icon" onclick="window.chargerDossier('${docSnap.id}')" title="Voir/Modifier"><i class="fas fa-eye" style="color:#3b82f6;"></i></button>
                    <button class="btn-icon" onclick="window.supprimerDossier('${docSnap.id}')" title="Supprimer"><i class="fas fa-trash" style="color:#ef4444;"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { 
        console.error(e); 
        tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center">Erreur chargement : ${e.message}</td></tr>`; 
    }
}

export async function chargerDossier(id) {
    try {
        const docRef = doc(db, "dossiers_admin", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.showSection('admin');
            
            // 1. Vider d'abord le formulaire pour éviter les mélanges
            window.viderFormulaire();
            document.getElementById('dossier_id').value = id;
            
            // 2. Remplissage Identité & Mandant
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
                setVal('adresse_fr', data.defunt.adresse); // Domicile
                setVal('pere', data.defunt.pere);
                setVal('mere', data.defunt.mere);
                setVal('matrimoniale', data.defunt.situation);
                setVal('conjoint', data.defunt.conjoint);
                setVal('profession_libelle', data.defunt.profession);
                setVal('nationalite', data.defunt.nationalite);
            }
            if(data.mandant) {
                setVal('civilite_mandant', data.mandant.civility);
                setVal('soussigne', data.mandant.nom);
                setVal('lien', data.mandant.lien);
                setVal('demeurant', data.mandant.adresse);
            }

            // 3. Remplissage Technique
            if(data.technique) {
                setVal('prestation', data.technique.type_operation);
                setVal('lieu_mise_biere', data.technique.lieu_mise_biere);
                setVal('date_fermeture', data.technique.date_fermeture);
                setVal('immatriculation', data.technique.vehicule);
                setVal('cimetiere_nom', data.technique.cimetiere);
                setVal('crematorium_nom', data.technique.crematorium);
                setVal('num_concession', data.technique.num_concession);
                setVal('titulaire_concession', data.technique.titulaire_concession);
                setVal('date_inhumation', data.technique.date_ceremonie);
                setVal('date_cremation', data.technique.date_ceremonie);
                setVal('heure_inhumation', data.technique.heure_ceremonie);
                setVal('heure_cremation', data.technique.heure_ceremonie);
                setVal('faita', data.technique.faita);
                setVal('dateSignature', data.technique.date_signature);
                
                // Police / Famille
                if(data.technique.police_nom) {
                    document.getElementById('type_presence_select').value = 'police';
                    setVal('p_nom_grade', data.technique.police_nom);
                    setVal('p_commissariat', data.technique.police_commissariat);
                } else {
                    document.getElementById('type_presence_select').value = 'famille';
                    setVal('f_nom_prenom', data.technique.temoin_nom);
                    setVal('f_lien', data.technique.temoin_lien);
                }
            }

            // 4. Remplissage Transport & Vols
            if(data.transport) {
                setVal('av_lieu_depart', data.transport.av_dep); setVal('av_lieu_arrivee', data.transport.av_arr);
                setVal('ap_lieu_depart', data.transport.ap_dep); setVal('ap_lieu_arrivee', data.transport.ap_arr);
                setVal('rap_pays', data.transport.rap_pays); setVal('rap_ville', data.transport.rap_ville);
                setVal('rap_lta', data.transport.rap_lta);
                setVal('vol1_num', data.transport.vol1); setVal('vol2_num', data.transport.vol2);
            }

            // 5. CORRECTION : Chargement de la GED
            const gedDiv = document.getElementById('liste_pieces_jointes');
            gedDiv.innerHTML = '<div style="color:#94a3b8; font-style:italic;">Aucun document joint.</div>';
            
            if(data.ged && Array.isArray(data.ged) && data.ged.length > 0) {
                gedDiv.innerHTML = ""; // On vide le message "aucun"
                data.ged.forEach(docName => {
                    const div = document.createElement('div');
                    div.style = "background:white; padding:5px 10px; border-radius:4px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;";
                    div.innerHTML = `
                        <span><i class="fas fa-file-pdf" style="color:#ef4444; margin-right:5px;"></i> ${docName}</span>
                        <i class="fas fa-trash" style="color:#94a3b8; cursor:pointer;" onclick="this.parentElement.remove()"></i>
                    `;
                    gedDiv.appendChild(div);
                });
            }

            // Mettre à jour l'affichage des blocs conditionnels
            if(window.toggleSections) window.toggleSections();
            if(window.togglePolice) window.togglePolice();

            alert("Dossier chargé avec succès !");
        }
    } catch(e) { alert("Erreur chargement : " + e.message); }
}

export async function sauvegarderDossier() {
    const btn = document.getElementById('btn-save-bdd');
    btn.innerHTML = "Sauvegarde...";
    
    const id = document.getElementById('dossier_id').value;

    // CORRECTION : Récupération de la liste GED depuis l'écran
    let gedList = [];
    document.querySelectorAll('#liste_pieces_jointes div span').forEach(span => {
        gedList.push(span.innerText.trim());
    });

    const data = {
        date_modification: new Date().toISOString(),
        defunt: {
            civility: getVal('civilite_defunt'),
            nom: getVal('nom'), prenom: getVal('prenom'), nom_jeune_fille: getVal('nom_jeune_fille'),
            date_deces: getVal('date_deces'), lieu_deces: getVal('lieu_deces'), heure_deces: getVal('heure_deces'),
            date_naiss: getVal('date_naiss'), lieu_naiss: getVal('lieu_naiss'),
            adresse: getVal('adresse_fr'), nationalite: getVal('nationalite'),
            pere: getVal('pere'), mere: getVal('mere'),
            situation: getVal('matrimoniale'), conjoint: getVal('conjoint'),
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
            // Police / Témoin
            police_nom: getVal('p_nom_grade'),
            police_commissariat: getVal('p_commissariat'),
            temoin_nom: getVal('f_nom_prenom'),
            temoin_lien: getVal('f_lien')
        },
        transport: {
            av_dep: getVal('av_lieu_depart'), av_arr: getVal('av_lieu_arrivee'),
            ap_dep: getVal('ap_lieu_depart'), ap_arr: getVal('ap_lieu_arrivee'),
            rap_pays: getVal('rap_pays'), rap_ville: getVal('rap_ville'), rap_lta: getVal('rap_lta'),
            vol1: getVal('vol1_num'), vol2: getVal('vol2_num')
        },
        ged: gedList // <-- C'est ici qu'on sauvegarde enfin la GED !
    };

    try {
        if(id) {
            await updateDoc(doc(db, "dossiers_admin", id), data);
            alert("✅ Dossier mis à jour !");
        } else {
            data.date_creation = new Date().toISOString();
            const docRef = await addDoc(collection(db, "dossiers_admin"), data);
            document.getElementById('dossier_id').value = docRef.id;
            alert("✅ Nouveau dossier créé !");
        }
        chargerBaseClients();
    } catch(e) { 
        console.error(e);
        alert("Erreur sauvegarde: " + e.message); 
    }
    btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
}

export async function supprimerDossier(id) {
    if(confirm("Supprimer définitivement ce dossier ?")) { 
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

// --- STOCKS ---
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
