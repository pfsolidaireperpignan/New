/* js/facturation.js - VERSION FINALE (OEIL = APERÇU PDF) */
import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- INFOS BANCAIRES ---
const INFO_SOCIETE = {
    banque: "BANQUE POPULAIRE DU SUD",
    iban: "FR76 1660 7000 0738 2217 4454 393",
    conditions: "Paiement à réception."
};

let paiements = []; 
let cacheDepenses = []; 
let cacheFactures = []; 
let global_CA = 0; 
let global_Depenses = 0; 
let logoBase64 = null; 
const currentYear = new Date().getFullYear();

// --- INIT ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        chargerLogoBase64();
        initYearFilter();
        window.chargerListeFactures();
        window.chargerDepenses();
        chargerSuggestionsClients();
        if(document.getElementById('dep_date_fac')) document.getElementById('dep_date_fac').valueAsDate = new Date();
        
        const el = document.getElementById('tbody_lignes');
        if(el && window.Sortable) {
            new Sortable(el, { handle: '.drag-handle', animation: 150, onEnd: window.calculTotal });
        }
    }
});

function initYearFilter() {
    const opts = `<option value="">Année (Toutes)</option>` + 
                 [0,1,2].map(i => `<option value="${currentYear-i}" ${i===0?'selected':''}>${currentYear-i}</option>`).join('');
    
    if(document.getElementById('filter_year')) document.getElementById('filter_year').innerHTML = opts;
    if(document.getElementById('filter_fac_year')) document.getElementById('filter_fac_year').innerHTML = opts;
}

function chargerLogoBase64() { 
    const img = document.getElementById('logo-source'); 
    if (img && img.naturalWidth > 0) { 
        const c = document.createElement("canvas"); 
        c.width=img.naturalWidth; c.height=img.naturalHeight; 
        c.getContext("2d").drawImage(img,0,0); 
        try{logoBase64=c.toDataURL("image/png");}catch(e){} 
    } 
}

// --- 1. FACTURES / DEVIS ---
window.chargerListeFactures = async function() {
    const tbody = document.getElementById('list-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Chargement...</td></tr>';
    
    try {
        const q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"));
        const snap = await getDocs(q);
        global_CA = 0; cacheFactures = [];
        
        snap.forEach((docSnap) => {
            const d = docSnap.data(); d.id = docSnap.id;
            d.finalNumero = d.numero || d.info?.numero || "BROUILLON";
            d.finalDate = d.date || d.info?.date || d.date_document || d.date_creation;
            d.finalType = d.type || d.info?.type || "DEVIS";
            d.finalTotal = parseFloat(d.total || d.info?.total || d.total_ttc || 0);
            d.finalClient = d.client_nom || d.client?.nom || "Inconnu";
            d.finalDefunt = d.defunt_nom || d.defunt?.nom || "";
            d.finalPaiements = d.paiements || [];
            
            if(d.finalType === 'DEVIS' && !d.statut_doc) d.statut_doc = 'En cours';
            
            cacheFactures.push(d);
            
            if (d.finalType === "FACTURE" && new Date(d.date_creation).getFullYear() === currentYear) global_CA += d.finalTotal;
        });
        window.filtrerFactures(); window.chargerDepenses();
    } catch(e) { console.error(e); }
};

window.filtrerFactures = function() {
    const term = (document.getElementById('search-facture')?.value || "").toLowerCase();
    
    const fMonth = document.getElementById('filter_fac_month')?.value;
    const fYear = document.getElementById('filter_fac_year')?.value;
    const fType = document.getElementById('filter_fac_type')?.value;
    const fStatut = document.getElementById('filter_fac_statut')?.value;

    const tbody = document.getElementById('list-body'); tbody.innerHTML = "";
    
    const results = cacheFactures.filter(d => {
        const textMatch = (d.finalNumero.toLowerCase().includes(term)) || (d.finalClient.toLowerCase().includes(term));
        const typeMatch = !fType || fType === "" || d.finalType === fType;

        let dateMatch = true;
        const dDate = new Date(d.finalDate);
        if (fYear && fYear !== "" && dDate.getFullYear() != fYear) dateMatch = false;
        if (fMonth && fMonth !== "" && dDate.getMonth() != fMonth) dateMatch = false;

        let statutMatch = true;
        if (fStatut && fStatut !== "") {
            if (d.finalType === 'FACTURE') {
                const paye = d.finalPaiements.reduce((s, p) => s + parseFloat(p.montant), 0);
                const reste = d.finalTotal - paye;
                const isPaye = reste < 0.1;
                
                if (fStatut === "Payé" && !isPaye) statutMatch = false;
                if (fStatut === "En attente" && isPaye) statutMatch = false;
                if (fStatut.includes("Devis")) statutMatch = false; 
            }
            else if (d.finalType === 'DEVIS') {
                if (fStatut === "Payé" || fStatut === "En attente") statutMatch = false;
                if (fStatut === "Devis En cours" && (d.statut_doc === "Sans suite" || d.statut_doc === "Validé")) statutMatch = false;
                if (fStatut === "Devis Sans suite" && d.statut_doc !== "Sans suite") statutMatch = false;
            }
        } else {
            if (d.finalType === 'DEVIS' && d.statut_doc === "Sans suite") statutMatch = false;
        }

        return textMatch && typeMatch && dateMatch && statutMatch;
    });
    
    if(results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#94a3b8;">Aucun document trouvé.</td></tr>';
        return;
    }

    results.forEach(d => {
        const paye = d.finalPaiements.reduce((s, p) => s + parseFloat(p.montant), 0);
        const reste = d.finalTotal - paye;
        let dateAffiche = "-";
        try { dateAffiche = new Date(d.finalDate).toLocaleDateString(); } catch(e){}
        
        let badgeClass = d.finalType === 'FACTURE' ? 'badge-facture' : 'badge-devis';
        let statusColor = reste > 0.1 ? '#ef4444' : '#10b981'; 
        
        let rowStyle = "";
        let classerBtn = "";
        let statutText = d.finalType;

        if (d.finalType === 'DEVIS') {
            if (d.statut_doc === 'Validé') {
                statutText = "DEVIS";
                badgeClass = "badge-devis"; 
                classerBtn = `<div style="width:34px; text-align:center; color:#10b981; font-size:1.2rem;" title="Déjà facturé"><i class="fas fa-check-circle"></i></div>`;
            } 
            else if (d.statut_doc === 'Sans suite') {
                rowStyle = "background-color:#f3f4f6; color:#9ca3af; text-decoration:line-through;";
                badgeClass = "badge-gris"; 
                statutText = "SANS SUITE";
                classerBtn = `<button class="btn-icon" style="color:#10b981;" onclick="window.classerSansSuite('${d.id}', 'En cours')" title="Réactiver"><i class="fas fa-undo"></i></button>`;
            } 
            else {
                statutText = "DEVIS";
                badgeClass = "badge-devis";
                classerBtn = `<button class="btn-icon" style="color:#6b7280;" onclick="window.classerSansSuite('${d.id}', 'Sans suite')" title="Classer Sans Suite"><i class="fas fa-archive"></i></button>`;
            }
        }

        const tr = document.createElement('tr');
        tr.style = rowStyle;
        tr.innerHTML = `
            <td class="link-doc" onclick="window.chargerDocument('${d.id}')" style="cursor:pointer; color:#3b82f6;"><strong>${d.finalNumero}</strong></td>
            <td>${dateAffiche}</td>
            <td><span class="badge ${badgeClass}">${statutText}</span></td>
            <td><strong>${d.finalClient}</strong></td>
            <td>${d.finalDefunt}</td>
            <td style="text-align:right;">${d.finalTotal.toFixed(2)} €</td>
            <td style="text-align:right; font-weight:bold; color:${statusColor};">${reste.toFixed(2)} €</td>
            <td style="text-align:center; display:flex; justify-content:center; gap:5px;">
                <button class="btn-icon" onclick="window.apercuDocument('${d.id}')" title="Aperçu PDF"><i class="fas fa-eye"></i></button>
                ${classerBtn}
                <button class="btn-icon" style="color:red;" onclick="window.supprimerDocument('${d.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });
};

window.classerSansSuite = async function(id, etat) {
    if(!confirm(etat === 'Sans suite' ? "Classer ce devis 'Sans suite' ?" : "Réactiver ce devis ?")) return;
    try {
        await updateDoc(doc(db, "factures_v2", id), { statut_doc: etat });
        window.chargerListeFactures();
    } catch(e) { alert("Erreur: " + e.message); }
};

// --- NOUVELLE FONCTION : APERÇU DOCUMENT (SANS CHARGER LE FORMULAIRE) ---
window.apercuDocument = async function(id) {
    try {
        const docSnap = await getDoc(doc(db, "factures_v2", id));
        if (!docSnap.exists()) { alert("Document introuvable."); return; }
        const data = docSnap.data();

        // On prépare les données pour le générateur PDF
        const pdfData = {
            client: { 
                nom: data.client_nom, 
                adresse: data.client_adresse, 
                civility: data.client_civility || '' 
            },
            defunt: { 
                nom: data.defunt_nom, 
                naiss: data.defunt_date_naiss, 
                deces: data.defunt_date_deces 
            },
            info: { 
                type: data.type, 
                date: data.date, 
                numero: data.numero, 
                total: parseFloat(data.total) 
            },
            lignes: data.lignes || [],
            paiements: data.paiements || []
        };

        // On génère le PDF sans l'enregistrer (false)
        window.generatePDFFromData(pdfData, false);

    } catch (e) {
        console.error(e);
        alert("Erreur lors de l'aperçu : " + e.message);
    }
};

// --- 2. DEPENSES ---
window.toggleNewExpenseForm = function() { const c = document.getElementById('container-form-depense'); c.classList.toggle('open'); if(!c.classList.contains('open')) window.resetFormDepense(); };

window.chargerDepenses = async function() { 
    try { 
        const q = query(collection(db, "depenses"), orderBy("date", "desc")); 
        const snap = await getDocs(q); 
        cacheDepenses = []; global_Depenses = 0; 
        const suppliers = new Set(); 
        
        snap.forEach(docSnap => { 
            const data = docSnap.data(); 
            data.id = docSnap.id; 
            cacheDepenses.push(data); 
            if(new Date(data.date).getFullYear() === currentYear && data.statut === 'Réglé') {
                global_Depenses += (parseFloat(data.montant) || 0); 
            }
            if(data.fournisseur) suppliers.add(data.fournisseur); 
        }); 
        
        updateFinancialDashboard(); 
        window.filtrerDepenses(); 
        updateFournisseursList(suppliers); 
    } catch(e) {} 
};

function updateFinancialDashboard() { 
    document.getElementById('stat-ca').innerText = global_CA.toFixed(2) + " €"; 
    document.getElementById('stat-depenses').innerText = global_Depenses.toFixed(2) + " €"; 
    document.getElementById('stat-resultat').innerText = (global_CA - global_Depenses).toFixed(2) + " €"; 
}

function updateFournisseursList(suppliers) { 
    const dl = document.getElementById('fournisseurs_list'); 
    if(dl) dl.innerHTML = Array.from(suppliers).map(s => `<option value="${s}">`).join(''); 
}

window.filtrerDepenses = function() { 
    const term = (document.getElementById('search_depense')?.value || "").toLowerCase();
    const selMonth = document.getElementById('filter_month')?.value; 
    const selYear = document.getElementById('filter_year')?.value;   
    const cat = document.getElementById('filter_cat')?.value;
    const statut = document.getElementById('filter_statut')?.value;

    const tbody = document.getElementById('depenses-body'); 
    if(!tbody) return;
    tbody.innerHTML = ""; 

    const filtered = cacheDepenses.filter(d => { 
        const textMatch = (d.fournisseur + " " + (d.details||"") + " " + d.categorie).toLowerCase().includes(term);
        const catMatch = !cat || cat === "" || d.categorie === cat;
        const statutMatch = !statut || statut === "" || d.statut === statut;
        
        let dateMatch = true;
        const dDate = new Date(d.date);
        if (selYear && selYear !== "" && dDate.getFullYear() != selYear) dateMatch = false;
        if (selMonth && selMonth !== "" && dDate.getMonth() != selMonth) dateMatch = false;

        return textMatch && catMatch && statutMatch && dateMatch;
    }); 

    const totalFilter = filtered.reduce((s, d) => s + (parseFloat(d.montant) || 0), 0); 
    const displayTotal = document.getElementById('total-filtre-display');
    if(displayTotal) displayTotal.innerText = totalFilter.toFixed(2) + " €"; 

    filtered.forEach(d => { 
        const badge = d.statut==='Réglé' 
            ? `<span class="badge badge-regle">Réglé</span>` 
            : `<span class="badge badge-attente" onclick="window.marquerCommeRegle('${d.id}')">En attente</span>`; 
        
        let dateRegleHtml = "";
        if (d.statut === 'Réglé' && d.date_reglement) {
            dateRegleHtml = `<br><span style="font-size:0.7rem; color:#059669;"><i class="fas fa-check"></i> Réglé le ${new Date(d.date_reglement).toLocaleDateString()}</span>`;
        }
        const detailsHtml = d.details ? `<br><span style="font-size:0.8rem; color:#6b7280; font-style:italic;">${d.details}</span>` : "";

        const tr = document.createElement('tr'); 
        tr.innerHTML = `
            <td><span style="font-weight:600;">${new Date(d.date).toLocaleDateString()}</span>${dateRegleHtml}</td>
            <td><strong>${d.fournisseur}</strong>${detailsHtml}<br><small style="color:#d97706; font-size:0.75rem;">${d.categorie}</small></td>
            <td>${d.reference||'-'}</td>
            <td>${badge}</td>
            <td style="text-align:right;">-${parseFloat(d.montant).toFixed(2)} €</td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.preparerModification('${d.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="window.supprimerDepense('${d.id}')"><i class="fas fa-trash"></i></button>
            </td>`; 
        tbody.appendChild(tr); 
    }); 
};

window.gererDepense = async function() { 
    const id = document.getElementById('dep_edit_id').value; 
    const data = { 
        date: document.getElementById('dep_date_fac').value, reference: document.getElementById('dep_ref').value, fournisseur: document.getElementById('dep_fourn').value, 
        details: document.getElementById('dep_details').value, categorie: document.getElementById('dep_cat').value, mode: document.getElementById('dep_mode').value, 
        statut: document.getElementById('dep_statut').value, montant: parseFloat(document.getElementById('dep_montant').value) || 0, date_reglement: document.getElementById('dep_date_reg').value 
    }; 
    if(!data.date) return alert("Date requise"); 
    try { 
        if(id) { await updateDoc(doc(db, "depenses", id), data); alert("✅ Modifié !"); } 
        else { await addDoc(collection(db, "depenses"), data); } 
        window.resetFormDepense(); document.getElementById('container-form-depense').classList.remove('open'); window.chargerDepenses(); 
    } catch(e){alert(e.message);} 
};

window.resetFormDepense = function() { document.getElementById('dep_edit_id').value = ""; document.getElementById('form-depense').reset(); document.getElementById('btn-action-depense').innerHTML="ENREGISTRER"; };
window.preparerModification = function(id) { 
    const d = cacheDepenses.find(x=>x.id===id); 
    if(d) { 
        document.getElementById('dep_edit_id').value=id; document.getElementById('dep_date_fac').value=d.date; document.getElementById('dep_ref').value=d.reference; 
        document.getElementById('dep_fourn').value=d.fournisseur; document.getElementById('dep_montant').value=d.montant; document.getElementById('dep_cat').value=d.categorie; 
        document.getElementById('dep_details').value = d.details || ""; 
        document.getElementById('dep_mode').value=d.mode; document.getElementById('dep_statut').value=d.statut; 
        document.getElementById('btn-action-depense').innerHTML="MODIFIER"; document.getElementById('container-form-depense').classList.add('open'); 
    } 
};
window.marquerCommeRegle = async function(id) { if(confirm("Valider paiement ?")) { await updateDoc(doc(db, "depenses", id), { statut: "Réglé", date_reglement: new Date().toISOString().split('T')[0] }); window.chargerDepenses(); } };
window.supprimerDepense = async (id) => { if(confirm("Supprimer ?")) { await deleteDoc(doc(db,"depenses",id)); window.chargerDepenses(); } };

// --- 3. UI GENERALE ---
window.showDashboard = function() { document.getElementById('view-editor').classList.add('hidden'); document.getElementById('view-dashboard').classList.remove('hidden'); window.chargerListeFactures(); };
window.switchTab = function(tab) { document.getElementById('tab-factures').classList.add('hidden'); document.getElementById('tab-achats').classList.add('hidden'); document.getElementById('btn-tab-factures').classList.remove('active'); document.getElementById('btn-tab-achats').classList.remove('active'); if(tab === 'factures') { document.getElementById('tab-factures').classList.remove('hidden'); document.getElementById('btn-tab-factures').classList.add('active'); } else { document.getElementById('tab-achats').classList.remove('hidden'); document.getElementById('btn-tab-achats').classList.add('active'); window.chargerDepenses(); } };
window.nouveauDocument = function() { document.getElementById('current_doc_id').value = ""; document.getElementById('doc_numero').value = "Auto"; document.getElementById('client_nom').value = ""; document.getElementById('client_adresse').value = ""; document.getElementById('defunt_nom').value = ""; document.getElementById('doc_type').value = "DEVIS"; document.getElementById('tbody_lignes').innerHTML = ""; paiements = []; window.renderPaiements(); window.calculTotal(); document.getElementById('btn-transform').style.display = 'none'; document.getElementById('view-dashboard').classList.add('hidden'); document.getElementById('view-editor').classList.remove('hidden'); };

// CHARGEMENT DOCUMENT (FORMULAIRE)
window.chargerDocument = async (id) => { 
    const d = await getDoc(doc(db,"factures_v2",id)); 
    if(d.exists()) { 
        const data = d.data(); 
        document.getElementById('current_doc_id').value = id; 
        document.getElementById('doc_numero').value = data.numero || data.info?.numero; 
        document.getElementById('client_nom').value = data.client_nom || data.client?.nom; 
        document.getElementById('client_adresse').value = data.client_adresse || data.client?.adresse; 
        
        // On récupère aussi la civilité (pour sauvegarde)
        const civility = data.client_civility || data.client?.civility || 'M.';
        document.getElementById('client_civility').value = civility;

        document.getElementById('defunt_nom').value = data.defunt_nom || data.defunt?.nom;
        document.getElementById('defunt_date_naiss').value = data.defunt_date_naiss || data.defunt?.date_naiss || "";
        document.getElementById('defunt_date_deces').value = data.defunt_date_deces || data.defunt?.date_deces || "";
        document.getElementById('doc_type').value = data.type || data.info?.type; 
        document.getElementById('doc_date').value = data.date || data.info?.date; 
        document.getElementById('tbody_lignes').innerHTML = ""; 
        if(data.lignes) data.lignes.forEach(l => { if(l.type==='section') window.ajouterSection(l.text); else window.ajouterLigne(l.desc, l.prix, l.cat); }); 
        paiements = data.paiements || []; 
        window.renderPaiements(); window.calculTotal(); 
        document.getElementById('btn-transform').style.display = (document.getElementById('doc_type').value === 'DEVIS') ? 'block' : 'none'; 
        document.getElementById('view-dashboard').classList.add('hidden'); document.getElementById('view-editor').classList.remove('hidden'); 
    } 
};

// AJOUT LIGNE
window.ajouterLigne = function(desc="", prix=0, type="Courant") { 
    if(type === 'Avance') type = 'Courant';
    const tr = document.createElement('tr'); 
    tr.className = "row-item"; 
    tr.innerHTML = `<td class="drag-handle"><i class="fas fa-grip-lines" style="color:#cbd5e1; cursor:grab;"></i></td><td><input type="text" class="input-cell val-desc" value="${desc}"></td><td><select class="input-cell val-type"><option value="Courant" ${type==='Courant'?'selected':''}>Courant</option><option value="Optionnel" ${type==='Optionnel'?'selected':''}>Optionnel</option></select></td><td style="text-align:right;"><input type="number" class="input-cell val-prix" value="${prix}" step="0.01" oninput="window.calculTotal()"></td><td style="text-align:center;"><i class="fas fa-trash" style="color:red;cursor:pointer;" onclick="this.closest('tr').remove(); window.calculTotal();"></i></td>`; 
    document.getElementById('tbody_lignes').appendChild(tr); 
    window.calculTotal(); 
};

// AJOUT SECTION
window.ajouterSection = function(titre="SECTION") { 
    const tr = document.createElement('tr'); 
    tr.className = "row-section"; 
    tr.innerHTML = `
        <td class="drag-handle"><i class="fas fa-grip-lines" style="color:#f97316; cursor:grab;"></i></td>
        <td colspan="4">
            <input type="text" class="input-cell input-section" value="${titre}" style="font-weight:bold; color:#c2410c; background-color:#ffedd5; border:1px solid #fed7aa;">
        </td>
        <td style="text-align:center;"><i class="fas fa-trash" style="color:red;cursor:pointer;" onclick="this.closest('tr').remove(); window.calculTotal();"></i></td>`; 
    document.getElementById('tbody_lignes').appendChild(tr); 
};

window.calculTotal = function() { let total = 0; document.querySelectorAll('.val-prix').forEach(i => total += parseFloat(i.value) || 0); document.getElementById('total_general').innerText = total.toFixed(2) + " €"; let paye = paiements.reduce((s, p) => s + parseFloat(p.montant), 0); document.getElementById('total_paye').innerText = paye.toFixed(2) + " €"; document.getElementById('reste_a_payer').innerText = (total - paye).toFixed(2) + " €"; document.getElementById('total_display').innerText = total.toFixed(2); };

// SAUVEGARDE (AVEC CIVILITÉ)
window.sauvegarderDocument = async function() { 
    const lignes = []; 
    document.querySelectorAll('#tbody_lignes tr').forEach(tr => { 
        if(tr.classList.contains('row-section')) lignes.push({ type: 'section', text: tr.querySelector('input').value }); 
        else lignes.push({ type: 'item', desc: tr.querySelector('.val-desc').value, cat: tr.querySelector('.val-type').value, prix: parseFloat(tr.querySelector('.val-prix').value)||0 }); 
    }); 
    const docData = { 
        type: document.getElementById('doc_type').value, numero: document.getElementById('doc_numero').value, date: document.getElementById('doc_date').value, 
        client_nom: document.getElementById('client_nom').value, 
        client_adresse: document.getElementById('client_adresse').value,
        client_civility: document.getElementById('client_civility').value, // Ajout Civilité
        defunt_nom: document.getElementById('defunt_nom').value, defunt_date_naiss: document.getElementById('defunt_date_naiss').value, defunt_date_deces: document.getElementById('defunt_date_deces').value,
        total: parseFloat(document.getElementById('total_display').innerText), lignes: lignes, paiements: paiements, date_creation: new Date().toISOString(),
        statut_doc: document.getElementById('doc_type').value === 'DEVIS' ? 'En cours' : 'Validé'
    }; 
    const id = document.getElementById('current_doc_id').value; 
    try { 
        if(id) {
            await updateDoc(doc(db, "factures_v2", id), docData); 
        } 
        else { 
            if(docData.numero === "" || docData.numero === "Auto") {
                const q = query(collection(db, "factures_v2")); 
                const snap = await getDocs(q); 
                let compteurType = 0;
                snap.forEach(d => {
                    const dType = d.data().type || d.data().info?.type;
                    if(dType === docData.type) compteurType++;
                });
                const prefix = docData.type === 'DEVIS' ? 'D' : 'F';
                docData.numero = `${prefix}-${currentYear}-${String(compteurType + 1).padStart(3, '0')}`;
            }
            await addDoc(collection(db, "factures_v2"), docData); 
        } 
        alert("✅ Enregistré !"); window.showDashboard(); 
    } catch(e) { alert("Erreur : " + e.message); } 
};

window.ajouterPaiement = () => { const p = { date: document.getElementById('pay_date').value, mode: document.getElementById('pay_mode').value, montant: parseFloat(document.getElementById('pay_amount').value) }; if(p.montant > 0) { paiements.push(p); window.renderPaiements(); window.calculTotal(); } };
window.supprimerPaiement = (i) => { paiements.splice(i, 1); window.renderPaiements(); window.calculTotal(); };
window.renderPaiements = () => { const div = document.getElementById('liste_paiements'); div.innerHTML = ""; paiements.forEach((p, i) => { div.innerHTML += `<div>${p.date} - ${p.mode}: <strong>${p.montant}€</strong> <i class="fas fa-trash" style="color:red;cursor:pointer;margin-left:10px;" onclick="window.supprimerPaiement(${i})"></i></div>`; }); };
window.supprimerDocument = async (id) => { if(confirm("Supprimer ?")) { await deleteDoc(doc(db,"factures_v2",id)); window.chargerListeFactures(); } };
window.transformerEnFacture = async function() { if(confirm("Créer une FACTURE à partir de ce devis ?")) { 
    const idDevis = document.getElementById('current_doc_id').value;
    if(idDevis) { try { await updateDoc(doc(db, "factures_v2", idDevis), { statut_doc: 'Validé' }); } catch(e) { console.log(e); } }
    document.getElementById('doc_type').value = "FACTURE"; document.getElementById('doc_date').valueAsDate = new Date(); document.getElementById('current_doc_id').value = ""; document.getElementById('doc_numero').value = "Auto"; window.sauvegarderDocument(); 
} };

// EXPORT EXCEL
window.exportExcelSmart = function() { 
    let csvContent = "data:text/csv;charset=utf-8,"; 
    if(!document.getElementById('tab-factures').classList.contains('hidden')) { 
        csvContent += "Numero;Date;Type;Client;Defunt;Total TTC;Reste a Payer\n"; 
        cacheFactures.forEach(d => { 
            const paye = d.finalPaiements.reduce((s, p) => s + parseFloat(p.montant), 0); 
            const reste = (d.finalTotal - paye).toFixed(2); 
            csvContent += `${d.finalNumero};${d.finalDate};${d.finalType};${d.finalClient};${d.finalDefunt};${d.finalTotal};${reste}\n`; 
        }); 
        const encodedUri = encodeURI(csvContent); 
        const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "export_ventes.csv"); 
        document.body.appendChild(link); link.click(); 
    } 
    else { 
        csvContent += "Date;Fournisseur;Reference;Categorie;Montant;Statut\n"; 
        cacheDepenses.forEach(d => { 
            csvContent += `${d.date};${d.fournisseur};${d.reference};${d.categorie};${d.montant};${d.statut}\n`; 
        }); 
        const encodedUri = encodeURI(csvContent); 
        const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "export_achats.csv"); 
        document.body.appendChild(link); link.click(); 
    } 
};

async function chargerSuggestionsClients() { try { const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc")); const snap = await getDocs(q); const dl = document.getElementById('clients_suggestions'); dl.innerHTML = ""; snap.forEach(doc => { if(doc.data().mandant?.nom) dl.innerHTML += `<option value="${doc.data().mandant.nom}">`; }); } catch(e){} }
window.checkClientAuto = function() { const val = document.getElementById('client_nom').value; const client = cacheFactures.find(f => f.finalClient === val); if(client) document.getElementById('client_adresse').value = client.client_adresse || client.client?.adresse || ''; };

// GESTION MODÈLES
window.loadTemplate = function(type) { 
    const MODELES = { 
        "Inhumation": [ { type: 'section', text: 'PREPARATION/ORGANISATION DES OBSEQUES' }, { desc: 'Démarches administratives', prix: 250, cat: 'Courant' }, { desc: 'Vacation de Police (Pose de scellés)', prix: 25, cat: 'Courant' }, { type: 'section', text: 'PRÉPARATION DU DÉFUNT' }, { desc: 'Toilette et habillage défunt (e)', prix: 150, cat: 'Courant' }, { desc: 'Séjour en chambre funéraire (Forfait 3 jours)', prix: 350, cat: 'Optionnel' }, { type: 'section', text: 'TRANSPORT AVANT MISE EN BIERE' }, { desc: 'Transport avant mise en bière', prix: 250, cat: 'Courant' }, { type: 'section', text: '3. CERCUEIL & ACCESSOIRES' }, { desc: 'Cercueil Azur inhumation (avec quatre poignées en métal cache vis plastique, et cuvette biodégradable)', prix: 850, cat: 'Courant' }, { desc: 'Capiton (Tissu intérieur)', prix: 80, cat: 'Courant' }, { desc: 'Plaque d\'identité gravée (Obligatoire)', prix: 25, cat: 'Courant' }, { desc: 'Emblème religieux / Civil', prix: 40, cat: 'Optionnel' }, { type: 'section', text: '4. CÉRÉMONIE & CONVOI' }, { desc: 'Corbillard de cérémonie avec chauffeur', prix: 400, cat: 'Courant' }, { desc: 'Porteurs (Equipe de 4 personnes)', prix: 600, cat: 'Courant' }, { desc: 'Maître de cérémonie (Organisation & Gestion)', prix: 200, cat: 'Optionnel' }, { desc: 'Frais de culte', prix: 220, cat: 'Optionnel' }, { desc: 'Registre de condoléances', prix: 35, cat: 'Optionnel' }, { type: 'section', text: '5. CIMETIÈRE' }, { desc: 'Creusement et comblement de fosse / Ouverture de caveau', prix: 650, cat: 'Courant' }, { desc: 'Redevance inhumation (Taxe Mairie)', prix: 50, cat: 'Courant' }, { desc: 'Achat de concession', prix: 50, cat: 'Courant' } ],
        "Cremation": [ { type: 'section', text: 'PREPARATION/ORGANISATION DES OBSEQUES' }, { desc: 'Démarches administratives', prix: 250, cat: 'Courant' }, { desc: 'Vacation de Police (Pose de scellés)', prix: 25, cat: 'Courant' }, { type: 'section', text: 'PRÉPARATION DU DÉFUNT' }, { desc: 'Toilette et habillage défunt (e)', prix: 150, cat: 'Courant' }, { desc: 'Séjour en chambre funéraire (Forfait 3 jours)', prix: 350, cat: 'Optionnel' }, { type: 'section', text: 'TRANSPORT AVANT MISE EN BIERE' }, { desc: 'Transport avant mise en bière', prix: 250, cat: 'Courant' }, { type: 'section', text: '3. CERCUEIL & ACCESSOIRES' }, { desc: 'Cercueil Azur inhumation (avec quatre poignées en métal cache vis plastique, et cuvette biodégradable)', prix: 850, cat: 'Courant' }, { desc: 'Capiton (Tissu intérieur)', prix: 80, cat: 'Courant' }, { desc: 'Plaque d\'identité gravée (Obligatoire)', prix: 25, cat: 'Courant' }, { desc: 'Emblème religieux / Civil', prix: 40, cat: 'Optionnel' }, { type: 'section', text: '4. CÉRÉMONIE & CONVOI' }, { desc: 'Corbillard de cérémonie avec chauffeur', prix: 400, cat: 'Courant' }, { desc: 'Porteurs (Equipe de 4 personnes)', prix: 600, cat: 'Courant' }, { desc: 'Maître de cérémonie (Organisation & Gestion)', prix: 200, cat: 'Optionnel' }, { desc: 'Frais de culte', prix: 220, cat: 'Optionnel' }, { desc: 'Registre de condoléances', prix: 35, cat: 'Optionnel' }, { type: 'section', text: '4. CRÉMATORIUM' }, { desc: 'Frais de Crémation ', prix: 750, cat: 'Courant' }, { desc: 'Urne', prix: 60, cat: 'Courant' } ],
        "Rapatriement": [ { type: 'section', text: 'PREPARATION/ORGANISATION DES OBSEQUES' }, { desc: 'Démarches administratives', prix: 250, cat: 'Courant' }, { desc: 'Vacation de Police (Pose de scellés)', prix: 25, cat: 'Courant' }, { type: 'section', text: 'PRÉPARATION DU DÉFUNT' }, { desc: 'Toilette et habillage défunt (e)', prix: 150, cat: 'Courant' }, { desc: 'Séjour en chambre funéraire (Forfait 3 jours)', prix: 350, cat: 'Optionnel' }, { type: 'section', text: 'TRANSPORT AVANT MISE EN BIERE' }, { desc: 'Transport avant mise en bière', prix: 250, cat: 'Courant' }, { type: 'section', text: '3. CERCUEIL & ACCESSOIRES' }, { desc: 'Cercueil Azur Rapatriement (avec quatre poignées en métal cache vis plastique,Filtre épurateur (Norme IATA) et cuvette biodégradable)', prix: 850, cat: 'Courant' }, { desc: 'Capiton (Tissu intérieur)', prix: 80, cat: 'Courant' }, { desc: 'Plaque d\'identité gravée (Obligatoire)', prix: 25, cat: 'Courant' }, { desc: 'Emblème religieux / Civil', prix: 40, cat: 'Optionnel' }, { type: 'section', text: '4. CÉRÉMONIE & CONVOI' }, { desc: 'Corbillard de cérémonie avec chauffeur', prix: 400, cat: 'Courant' }, { desc: 'Porteurs (Equipe de 4 personnes)', prix: 600, cat: 'Courant' }, { desc: 'Maître de cérémonie (Organisation & Gestion)', prix: 200, cat: 'Optionnel' }, { desc: 'Frais de culte', prix: 220, cat: 'Optionnel' }, { desc: 'Registre de condoléances', prix: 35, cat: 'Optionnel' }, { type: 'section', text: '4. TRANSPORT' }, { desc: 'Transport vers Aéroport (France)', prix: 350, cat: 'Courant' }, { desc: 'Fret Aérien ', prix: 1800, cat: 'Courant' } ],
        "Transport": [ { type: 'section', text: '1. TRANSPORT DE CORPS' }, { desc: 'Véhicule Agréé avec Caisson', prix: 300, cat: 'Courant' }, { desc: 'Chauffeur / Porteur', prix: 150, cat: 'Courant' }, { desc: 'Housse mortuaire impérméable', prix: 45, cat: 'Courant' }, { desc: 'Frais kilométriques (Au-delà du forfait)', prix: 0, cat: 'Courant' } ],
        "Exhumation": [ { type: 'section', text: '1. TECHNIQUE' }, { desc: 'Démarches Mairie & Cimetière', prix: 150, cat: 'Courant' }, { desc: 'Ouverture de monument / Fosse', prix: 600, cat: 'Courant' }, { desc: 'Exhumation du corps', prix: 450, cat: 'Courant' }, { desc: 'Fourniture Reliquaire (Boîte à ossements)', prix: 120, cat: 'Courant' }, { desc: 'Réduction de corps', prix: 200, cat: 'Optionnel' }, { desc: 'Fermeture de sépulture', prix: 200, cat: 'Courant' }, { desc: 'Vacation de Police', prix: 25, cat: 'Courant' } ],
        "Devis": [ { type: 'section', text: 'PRESTATIONS' }, { desc: 'Frais de dossier et démarches', prix: 150, cat: 'Courant' }, { desc: 'Véhicule avec chauffeur', prix: 300, cat: 'Courant' }, { desc: 'Personnel (Porteurs)', prix: 450, cat: 'Courant' }, { type: 'section', text: 'FOURNITURES' }, { desc: 'Cercueil', prix: 850, cat: 'Courant' }, { desc: 'Plaque d\'identité', prix: 25, cat: 'Courant' }, { desc: 'Urne / Accessoire', prix: 0, cat: 'Optionnel' } ]
    }; 
    document.getElementById('modal-choix').classList.add('hidden'); 
    window.nouveauDocument(); 
    if (MODELES[type]) { 
        document.getElementById('tbody_lignes').innerHTML = ""; 
        MODELES[type].forEach(item => { if(item.type === 'section') window.ajouterSection(item.text); else window.ajouterLigne(item.desc, item.prix, item.cat); }); 
    } 
    window.calculTotal(); 
};

// IMPRESSION PDF (LAYOUT OPTIMISÉ)
window.genererPDFFacture = function() {
    const data = {
        client: { nom: document.getElementById('client_nom').value, adresse: document.getElementById('client_adresse').value, civility: document.getElementById('client_civility').value },
        defunt: { nom: document.getElementById('defunt_nom').value, naiss: document.getElementById('defunt_date_naiss').value, deces: document.getElementById('defunt_date_deces').value },
        info: { type: document.getElementById('doc_type').value, date: document.getElementById('doc_date').value, numero: document.getElementById('doc_numero').value, total: parseFloat(document.getElementById('total_display').innerText) },
        lignes: [], paiements: paiements
    };
    document.querySelectorAll('#tbody_lignes tr').forEach(tr => {
        if(tr.classList.contains('row-section')) { data.lignes.push({ type: 'section', text: tr.querySelector('input').value }); } 
        else { data.lignes.push({ type: 'item', desc: tr.querySelector('.val-desc').value, cat: tr.querySelector('.val-type').value, prix: parseFloat(tr.querySelector('.val-prix').value)||0 }); }
    });
    window.generatePDFFromData(data, false);
};

window.generatePDFFromData = function(data, saveMode = false) {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF();
    const greenColor = [16, 185, 129]; 
    if (logoBase64) { try { doc.addImage(logoBase64,'PNG', 15, 10, 25, 25); } catch(e){} }
    doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(...greenColor);
    doc.text("PF SOLIDAIRE", 15, 40); doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(80); doc.text("32 Bd Léon Jean Grégory, Thuir", 15, 45);
    doc.setFillColor(245, 245, 245); doc.roundedRect(110, 10, 85, 25, 2, 2, 'F');
    doc.setFontSize(10); doc.setTextColor(0); doc.setFont("helvetica","bold");
    doc.text(`${data.client.civility || ''} ${data.client.nom}`, 115, 18);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); 
    doc.text(doc.splitTextToSize(data.client.adresse || '', 80), 115, 24);
    let y = 60; doc.setFontSize(14); doc.setFont("helvetica","bold"); doc.setTextColor(...greenColor);
    doc.text(`${data.info.type} N° ${data.info.numero}`, 15, y);
    doc.setFontSize(10); doc.setTextColor(0); doc.setFont("helvetica","normal");
    doc.text(`Date : ${new Date(data.info.date).toLocaleDateString()}`, 15, y+6);
    doc.text(`Défunt : ${data.defunt.nom}`, 15, y+12);
    let datesDefunt = ""; if(data.defunt.naiss) datesDefunt += `Né(e) le : ${new Date(data.defunt.naiss).toLocaleDateString()} `; if(data.defunt.deces) datesDefunt += `- Décédé(e) le : ${new Date(data.defunt.deces).toLocaleDateString()}`; doc.setFontSize(8); doc.setTextColor(100); doc.text(datesDefunt, 15, y+16);
    y += 25;
    const body = [];
    data.lignes.forEach(l => {
        if(l.type === 'section') { 
            body.push([{ content: l.text, colSpan: 3, styles: { fillColor: [255, 237, 213], textColor:[154, 52, 18], fontStyle: 'bold', halign:'left' } }]); 
        } 
        else { 
            let pCourant = "", pOptionnel = "";
            const prixFmt = parseFloat(l.prix).toFixed(2) + ' €';
            if (l.cat === 'Optionnel') pOptionnel = prixFmt; else pCourant = prixFmt; 
            body.push([l.desc, pCourant, pOptionnel]);
        }
    });
    doc.autoTable({ startY: y, head: [['Description', 'Prestations\nCourantes', 'Prestations\nOptionnelles']], body: body, theme: 'grid', styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [16, 185, 129], textColor: 255, halign: 'center', valign: 'middle' }, columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', cellWidth: 35 }, 2: { halign: 'right', cellWidth: 35 } } });
    
    // --- TOTAUX & PIED DE PAGE OPTIMISÉ ---
    let footerY = doc.lastAutoTable.finalY + 10;
    if (footerY > 250) { doc.addPage(); footerY = 20; }

    const rightLabelX = 165; const rightValueX = 195;
    const totalTTC = data.info.total;
    const totalPaye = data.paiements.reduce((sum, p) => sum + parseFloat(p.montant), 0);
    const resteAPayer = totalTTC - totalPaye;

    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(0);
    doc.text(`Total TTC :`, rightLabelX, footerY, { align: 'right' }); 
    doc.setFont("helvetica", "bold"); 
    doc.text(`${totalTTC.toFixed(2)} €`, rightValueX, footerY, { align: 'right' });
    footerY += 6;

    if (totalPaye > 0) { 
        doc.setFont("helvetica", "normal"); 
        doc.text(`Déjà réglé :`, rightLabelX, footerY, { align: 'right' }); 
        doc.text(`- ${totalPaye.toFixed(2)} €`, rightValueX, footerY, { align: 'right' }); 
        footerY += 6; 
    }
    
    doc.setLineWidth(0.5); doc.line(120, footerY, 195, footerY); footerY += 6;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); 
    doc.text(`Net à Payer :`, rightLabelX, footerY, { align: 'right' }); 
    doc.text(`${resteAPayer.toFixed(2)} €`, rightValueX, footerY, { align: 'right' });

    const leftX = 15;
    let leftY = doc.lastAutoTable.finalY + 10; 
    if (leftY > 250) leftY = 20; 

    if (data.info.type === 'DEVIS') {
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text("Bon pour accord (Date & Signature) :", leftX, leftY);
        doc.rect(leftX, leftY + 3, 80, 25);
    } else {
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text("RÈGLEMENT :", leftX, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(INFO_SOCIETE.conditions, leftX + 25, leftY);
        leftY += 5;
        doc.setFillColor(248, 250, 252); doc.rect(leftX, leftY, 90, 18, 'F'); doc.setDrawColor(200); doc.rect(leftX, leftY, 90, 18);
        doc.setFont("helvetica", "bold"); doc.text("COORDONNÉES BANCAIRES", leftX + 2, leftY + 4);
        doc.setFont("helvetica", "normal"); doc.text(`Banque : ${INFO_SOCIETE.banque}`, leftX + 2, leftY + 9);
        doc.text(`IBAN : ${INFO_SOCIETE.iban}`, leftX + 2, leftY + 14);
    }

    if(saveMode) doc.save(`${data.info.type}_${data.info.numero}.pdf`); else window.open(doc.output('bloburl'), '_blank');
};
