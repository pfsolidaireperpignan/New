/* js/pdf_modules.js - VOS PDF ORIGINAUX */

// Outils internes nécessaires pour les PDF
let logoBase64 = null;
function chargerLogoBase64() {
    const img = document.getElementById('logo-source');
    if (img && img.naturalWidth > 0) {
        const c = document.createElement("canvas"); c.width=img.naturalWidth; c.height=img.naturalHeight;
        c.getContext("2d").drawImage(img,0,0); try{logoBase64=c.toDataURL("image/png");}catch(e){}
    }
}
// Appel immédiat pour préparer le logo
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chargerLogoBase64); else chargerLogoBase64();

function ajouterFiligrane(pdf) {
    if (logoBase64) { try { pdf.saveGraphicsState(); pdf.setGState(new pdf.GState({opacity:0.06})); pdf.addImage(logoBase64,'PNG',55,98,100,100); pdf.restoreGraphicsState(); } catch(e){} }
}
function headerPF(pdf, y=20) {
    pdf.setFont("helvetica","bold"); pdf.setTextColor(34,155,76); pdf.setFontSize(12);
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN",105,y,{align:"center"});
    pdf.setTextColor(80); pdf.setFontSize(8); pdf.setFont("helvetica","normal");
    pdf.text("32 boulevard Léon Jean Grégory Thuir - TEL : 07.55.18.27.77",105,y+5,{align:"center"});
    pdf.text("HABILITATION N° : 23-66-0205 | SIRET : 53927029800042",105,y+9,{align:"center"});
    pdf.setDrawColor(34,155,76); pdf.setLineWidth(0.5); pdf.line(40,y+12,170,y+12);
}
function getVal(id) { return document.getElementById(id) ? document.getElementById(id).value : ""; }
function formatDate(d) { return d?d.split("-").reverse().join("/"): "................."; }

// --- EXPORTATION DES FONCTIONS ---

window.genererPouvoir = function() {
    if(!logoBase64) chargerLogoBase64(); const {jsPDF}=window.jspdf; const pdf=new jsPDF(); ajouterFiligrane(pdf); headerPF(pdf);
    let typePresta = document.getElementById('prestation').value.toUpperCase();
    if(typePresta === "RAPATRIEMENT") typePresta += ` vers ${getVal("rap_pays").toUpperCase()}`;
    pdf.setFillColor(241,245,249); pdf.rect(20,45,170,12,'F');
    pdf.setFontSize(16); pdf.setTextColor(185,28,28); pdf.setFont("helvetica","bold"); pdf.text("POUVOIR",105,53,{align:"center"});
    let y=75; const x=25; pdf.setFontSize(10); pdf.setTextColor(0); pdf.setFont("helvetica","normal");
    pdf.text(`Je soussigné(e) : ${getVal("civilite_mandant")} ${getVal("soussigne")}`,x,y); y+=8;
    pdf.text(`Demeurant à : ${getVal("demeurant")}`,x,y); y+=8;
    pdf.text(`Agissant en qualité de : ${getVal("lien")}`,x,y); y+=15;
    pdf.text("Ayant qualité pour pourvoir aux funérailles de :",x,y); y+=8;
    pdf.setDrawColor(200); pdf.setFillColor(250); pdf.rect(x-5,y-5,170,40,'FD');
    pdf.setFont("helvetica","bold"); pdf.text(`${getVal("civilite_defunt")} ${getVal("nom")} ${getVal("prenom")}`,x,y+2); y+=8;
    pdf.setFont("helvetica","normal");
    pdf.text(`Né(e) le ${formatDate(getVal("date_naiss"))} à ${getVal("lieu_naiss")}`,x,y); y+=6;
    pdf.text(`Décédé(e) le ${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`,x,y); y+=6;
    pdf.text(`Domicile : ${getVal("adresse_fr")}`,x,y); y+=12;
    pdf.setFont("helvetica","bold"); pdf.setTextColor(185,28,28); pdf.text(`POUR : ${typePresta}`,105,y,{align:"center"}); y+=15;
    pdf.setTextColor(0); pdf.setFont("helvetica","bold");
    pdf.text("Donne mandat aux PF SOLIDAIRE PERPIGNAN pour :",x,y); y+=8;
    pdf.setFont("helvetica","normal");
    pdf.text("- Effectuer toutes les démarches administratives.",x+5,y); y+=6;
    pdf.text("- Signer toute demande d'autorisation nécessaire.",x+5,y); y+=6;
    if(typePresta.includes("RAPATRIEMENT")) { pdf.text("- Accomplir les formalités consulaires.",x+5,y); y+=6; }
    y = 240; pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`,x,y);
    pdf.setFont("helvetica","bold"); pdf.text("Signature du Mandant",150,y,{align:"center"});
    pdf.save(`Pouvoir_${getVal("nom")}.pdf`);
};

window.genererDemandeRapatriement = function() {
    if(!logoBase64) chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    pdf.setDrawColor(0); pdf.setLineWidth(0.5); pdf.setFillColor(240, 240, 240);
    pdf.rect(15, 15, 180, 25, 'FD'); 
    pdf.setTextColor(0); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
    pdf.text("DEMANDE D'AUTORISATION DE TRANSPORT DE CORPS", 105, 23, {align:"center"});
    pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
    pdf.text("Dans le cas où la fermeture de cercueil a lieu dans les Pyrénées-Orientales", 105, 30, {align:"center"});
    let y = 55; const x = 15;
    pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
    pdf.text("Je soussigné(e) (nom et prénom) : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text("CHERKAOUI MUSTAPHA", x+60, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text("Représentant légal de : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text("Pompes Funèbres Solidaire Perpignan, 32 boulevard Léon Jean Grégory Thuir", x+40, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text("Habilitée sous le n° : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text("23-66-0205", x+35, y); y+=6;
    pdf.setFont("helvetica", "normal"); 
    pdf.text("Dûment mandaté par la famille de la défunte, sollicite l'autorisation de faire transporter en dehors du", x, y); y+=5;
    pdf.text("territoire métropolitain le corps après mise en bière de :", x, y); y+=10;
    pdf.text("Nom et prénom de la défunte : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text(`${getVal("nom").toUpperCase()} ${getVal("prenom")}`, x+55, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date et lieu de naissance    :  ${formatDate(getVal("date_naiss"))}`, x, y); 
    pdf.text(`à   ${getVal("lieu_naiss")}`, x+80, y); y+=6;
    pdf.text(`Décédé(e) le                       :  ${formatDate(getVal("date_deces"))}`, x, y); 
    pdf.text(`à   ${getVal("lieu_deces")}`, x+80, y); y+=8;
    pdf.setFont("helvetica", "normal"); pdf.text("Fille/Fils de (père) : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text(getVal("pere") || "", x+35, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text("et de (mère) : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text(getVal("mere") || "", x+35, y); y+=6;
    let situation = getVal("matrimoniale");
    const conjoint = getVal("conjoint");
    if(conjoint && conjoint.trim() !== "") {
        if(situation.includes("Veuf")) situation = "Veuve de " + conjoint;
        else if(situation.includes("Marié")) situation = "Epoux(se) de " + conjoint;
        else situation = situation + " " + conjoint;
    }
    pdf.setFont("helvetica", "normal"); pdf.text("Situation familiale : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text(situation, x+35, y); y+=10;
    pdf.setFont("helvetica", "bold"); pdf.text("Moyen de transport :", x+5, y); 
    pdf.setLineWidth(0.3); pdf.line(x+5, y+1, x+40, y+1); y+=8;
    pdf.rect(x+5, y-3, 2, 2, 'F'); pdf.text("Par voie routière :", x+10, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`> Avec le véhicule funéraire immatriculé : ${getVal("rap_immat")}`, x+15, y); y+=5;
    pdf.text(`> Date et heure de départ le : ${getVal("rap_date_dep_route")}`, x+15, y); y+=5;
    pdf.text(`> Lieu de départ : ${getVal("rap_ville_dep")}`, x+15, y); y+=5;
    pdf.text(`> Commune et pays d'arrivée : ${getVal("rap_ville_arr")}`, x+15, y); y+=8;
    pdf.setFont("helvetica", "bold");
    pdf.rect(x+5, y-3, 2, 2, 'F'); pdf.text("Par voie aérienne :", x+10, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`> Numéro de LTA : ${getVal("rap_lta")}`, x+15, y); y+=5;
    if(getVal("vol1_num")) { 
        pdf.text(`- Vol 1 : ${getVal("vol1_num")} (${getVal("vol1_dep_aero")} -> ${getVal("vol1_arr_aero")})`, x+25, y); y+=5;
        pdf.text(`- Départ : ${getVal("vol1_dep_time")}`, x+25, y); y+=5;
        pdf.text(`- Arrivée : ${getVal("vol1_arr_time")}`, x+25, y); y+=5;
    }
    if(document.getElementById('check_vol2').checked && getVal("vol2_num")) { 
        pdf.text(`- Vol 2 : ${getVal("vol2_num")} (${getVal("vol2_dep_aero")} -> ${getVal("vol2_arr_aero")})`, x+25, y); y+=5;
        pdf.text(`- Départ : ${getVal("vol2_dep_time")}`, x+25, y); y+=5;
        pdf.text(`- Arrivée : ${getVal("vol2_arr_time")}`, x+25, y); y+=5;
    }
    y+=5; pdf.setFont("helvetica", "normal");
    pdf.text(`Lieu d'inhumation du corps (Ville – Pays) : `, x, y);
    pdf.setFont("helvetica", "bold"); pdf.text(`${getVal("rap_ville")} (${getVal("rap_pays")})`, x+70, y); y+=20;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Fait à : ${getVal("faita")}`, 130, y); y+=6;
    pdf.text(`Le : ${formatDate(getVal("dateSignature"))}`, 130, y); y+=10;
    pdf.setFont("helvetica", "bold"); pdf.text("Signature et cachet :", 130, y);
    pdf.save(`Demande_Rapatriement_Prefecture_${getVal("nom")}.pdf`);
};

window.genererDeclaration = function() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF(); const fontMain = "times";
    pdf.setFont(fontMain, "bold"); pdf.setFontSize(16);
    pdf.text("DECLARATION DE DECES", 105, 30, { align: "center" });
    pdf.setLineWidth(0.5); pdf.line(75, 31, 135, 31);
    pdf.setFontSize(11);
    pdf.text("Dans tous les cas à remettre obligatoirement complété et signé", 105, 38, { align: "center" });
    pdf.line(55, 39, 155, 39);
    let y = 60; const margin = 20;
    const drawLine = (label, val, yPos) => {
        pdf.setFont(fontMain, "bold"); pdf.text(label, margin, yPos);
        const startDots = margin + pdf.getTextWidth(label) + 2;
        let curX = startDots; pdf.setFont(fontMain, "normal");
        while(curX < 190) { pdf.text(".", curX, yPos); curX += 2; }
        if(val) {
            pdf.setFont(fontMain, "bold"); pdf.setFillColor(255, 255, 255);
            pdf.rect(startDots, yPos - 4, pdf.getTextWidth(val)+5, 5, 'F');
            pdf.text(val.toUpperCase(), startDots + 2, yPos);
        }
    };
    drawLine("NOM : ", getVal("nom"), y); y+=14;
    drawLine("NOM DE JEUNE FILLE : ", getVal("nom_jeune_fille"), y); y+=14;
    drawLine("Prénoms : ", getVal("prenom"), y); y+=14;
    drawLine("Né(e) le : ", formatDate(getVal("date_naiss")), y); y+=14;
    drawLine("A : ", getVal("lieu_naiss"), y); y+=14;
    pdf.setFont(fontMain, "bold"); pdf.text("DATE ET LIEU DU DECES LE", margin, y);
    pdf.setFont(fontMain, "normal"); pdf.text(formatDate(getVal("date_deces")), margin+70, y);
    pdf.setFont(fontMain, "bold"); pdf.text("A", 120, y); pdf.text(getVal("lieu_deces").toUpperCase(), 130, y); y += 18;
    pdf.text("PROFESSION : ", margin, y); y+=8;
    const prof = getVal("prof_type"); pdf.setFont(fontMain, "normal");
    pdf.rect(margin+5, y-4, 5, 5); if(prof === "Sans profession") pdf.text("X", margin+6, y); pdf.text("Sans profession", margin+15, y);
    pdf.rect(margin+60, y-4, 5, 5); if(prof === "Retraité(e)") pdf.text("X", margin+61, y); pdf.text("retraité(e)", margin+70, y);
    if(prof === "Active") {
        const metier = getVal("profession_libelle") || "Active";
        pdf.setFont(fontMain, "bold"); pdf.text(metier.toUpperCase(), margin+110, y); 
    }
    y += 15;
    drawLine("DOMICILIE(E) ", getVal("adresse_fr"), y); y+=14;
    drawLine("FILS OU FILLE de (Père) :", getVal("pere"), y); y+=14;
    drawLine("Et de (Mère) :", getVal("mere"), y); y+=14;
    let situation = getVal("matrimoniale");
    const nomConjoint = getVal("conjoint");
    if (nomConjoint && nomConjoint.trim() !== "") {
        if (situation.includes("Marié")) situation = `MARIÉ(E) À ${nomConjoint}`;
        else if (situation.includes("Veuf")) situation = `VEUF(VE) DE ${nomConjoint}`;
        else if (situation.includes("Divorcé")) situation = `DIVORCÉ(E) DE ${nomConjoint}`;
    }
    drawLine("Situation Matrimoniale : ", situation, y); y+=14;
    drawLine("NATIONALITE : ", getVal("nationalite"), y); y+=25;
    pdf.setFont(fontMain, "bold"); pdf.text("NOM ET SIGNATURE DES POMPES FUNEBRES", 105, y, { align: "center" });
    pdf.save(`Declaration_Deces_${getVal("nom")}.pdf`);
};

window.genererDemandeInhumation = function() {
    if(!logoBase64) chargerLogoBase64(); const { jsPDF } = window.jspdf; const pdf = new jsPDF(); headerPF(pdf);
    pdf.setFillColor(230, 240, 230); pdf.rect(20, 40, 170, 10, 'F');
    pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("DEMANDE D'INHUMATION", 105, 47, { align: "center" });
    let y = 70; const x = 25;
    pdf.setFontSize(11); pdf.text("Monsieur le Maire,", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("Je soussigné M. CHERKAOUI Mustapha, dirigeant des PF Solidaire,", x, y); y+=6;
    pdf.text("Sollicite l'autorisation d'inhumer le défunt :", x, y); y+=12;
    pdf.setFont("helvetica", "bold"); pdf.text(`${getVal("civilite_defunt")} ${getVal("nom").toUpperCase()} ${getVal("prenom")}`, x+10, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text(`Décédé(e) le ${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`, x+10, y); y+=15;
    pdf.text("Lieu d'inhumation :", x, y); y+=6;
    pdf.setFont("helvetica", "bold"); pdf.text(`Cimetière : ${getVal("cimetiere_nom")}`, x+10, y); y+=6;
    pdf.text(`Le : ${formatDate(getVal("date_inhumation"))} à ${getVal("heure_inhumation")}`, x+10, y); y+=6;
    pdf.text(`Concession : ${getVal("num_concession")} (${getVal("type_sepulture")})`, x+10, y); y+=20;
    pdf.setFont("helvetica", "normal"); pdf.text("Veuillez agréer, Monsieur le Maire, mes salutations distinguées.", x, y); y+=20;
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, 130, y);
    pdf.save(`Demande_Inhumation_${getVal("nom")}.pdf`);
};

window.genererDemandeCremation = function() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF(); headerPF(pdf);
    pdf.setFont("times", "bold"); pdf.setFontSize(12);
    pdf.text(`${getVal("civilite_mandant")} ${getVal("soussigne")}`, 20, 45); 
    pdf.setFont("times", "normal"); pdf.text(getVal("demeurant"), 20, 51);
    pdf.setFont("times", "bold"); pdf.setFontSize(14);
    pdf.text("Monsieur le Maire", 150, 60, {align:"center"});
    pdf.setFontSize(12); pdf.text("OBJET : DEMANDE D'AUTORISATION DE CREMATION", 20, 80);
    let y = 100;
    pdf.setFont("times", "normal");
    const txt = `Monsieur le Maire,\n\nJe soussigné(e) ${getVal("civilite_mandant")} ${getVal("soussigne")}, agissant en qualité de ${getVal("lien")} du défunt(e), sollicite l'autorisation de procéder à la crémation de :\n\n${getVal("civilite_defunt")} ${getVal("nom").toUpperCase()} ${getVal("prenom")}\nNé(e) le ${formatDate(getVal("date_naiss"))} et décédé(e) le ${formatDate(getVal("date_deces"))}.\n\nLa crémation aura lieu le ${formatDate(getVal("date_cremation"))} au ${getVal("crematorium_nom")}.\nDestination des cendres : ${getVal("destination_cendres")}.\n\nJe certifie que le défunt n'était pas porteur d'un stimulateur cardiaque.`;
    const splitTxt = pdf.splitTextToSize(txt, 170); pdf.text(splitTxt, 20, y);
    y += (splitTxt.length * 7) + 20;
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, 120, y);
    pdf.setFont("times", "bold"); pdf.text("Signature", 120, y+8);
    pdf.save(`Demande_Cremation_${getVal("nom")}.pdf`);
};

window.genererFermeture = function() {
    if(!logoBase64) chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF(); 
    ajouterFiligrane(pdf); headerPF(pdf);
    pdf.setFillColor(52, 73, 94); pdf.rect(0, 35, 210, 15, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setTextColor(255, 255, 255);
    pdf.text("DÉCLARATION DE MISE EN BIÈRE, DE FERMETURE", 105, 41, { align: "center" });
    pdf.text("ET DE SCELLEMENT DE CERCUEIL", 105, 47, { align: "center" });
    pdf.setTextColor(0); pdf.setFontSize(10);
    let y = 65; const x = 20;
    pdf.setDrawColor(200); pdf.setLineWidth(0.5); pdf.rect(x, y, 170, 20);
    pdf.setFont("helvetica", "bold"); pdf.text("L'OPÉRATEUR FUNÉRAIRE", x+5, y+5);
    pdf.setFont("helvetica", "normal");
    pdf.text("PF SOLIDAIRE PERPIGNAN - 32 Bd Léon Jean Grégory, Thuir", x+5, y+10);
    pdf.text("Habilitation : 23-66-0205", x+5, y+15); y += 30;
    pdf.text("Je, soussigné M. CHERKAOUI Mustapha, certifie avoir procédé à la mise en bière,", x, y);
    pdf.text("à la fermeture et au scellement du cercueil.", x, y+5); y+=15;
    pdf.setFont("helvetica", "bold");
    pdf.text(`DATE : ${formatDate(getVal("date_fermeture"))}`, x, y);
    pdf.text(`LIEU : ${getVal("lieu_mise_biere")}`, x+80, y); y+=15;
    pdf.setFillColor(240, 240, 240); pdf.rect(x, y, 170, 30, 'F');
    pdf.setFont("helvetica", "bold"); pdf.text("IDENTITÉ DU DÉFUNT(E)", x+5, y+6);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Nom : ${getVal("civilite_defunt")} ${getVal("nom").toUpperCase()}`, x+5, y+14); pdf.text(`Prénom : ${getVal("prenom")}`, x+80, y+14);
    pdf.text(`Né(e) le : ${formatDate(getVal("date_naiss"))}`, x+5, y+22); pdf.text(`Décédé(e) le : ${formatDate(getVal("date_deces"))}`, x+80, y+22); y+=40;
    const typePresence = document.getElementById('type_presence_select').value;
    const isPolice = (typePresence === 'police'); 
    pdf.setFont("helvetica", "bold"); pdf.text("EN PRÉSENCE DE :", x, y); y+=10;
    pdf.setDrawColor(0); pdf.rect(x, y, 170, 30);
    if(isPolice) {
        pdf.text("AUTORITÉ DE POLICE (Absence de famille)", x+5, y+6);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Nom & Grade : ${getVal("p_nom_grade")}`, x+5, y+14);
        pdf.text(`Commissariat : ${getVal("p_commissariat")}`, x+5, y+22);
    } else {
        pdf.text("LA FAMILLE (Témoin)", x+5, y+6);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Nom : ${getVal("f_nom_prenom")}`, x+5, y+14);
        pdf.text(`Lien : ${getVal("f_lien")}`, x+80, y+14);
        pdf.text(`Adresse : ${getVal("demeurant")}`, x+5, y+22); 
    }
    y+=45; pdf.line(20, y, 190, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Signature Opérateur", 40, y);
    pdf.text(isPolice ? "Signature Police" : "Signature Famille", 140, y);
    pdf.save(`PV_Mise_En_Biere_Fermeture_${getVal("nom")}.pdf`);
};

window.genererDemandeOuverture = function() {
    if(!logoBase64) chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF(); headerPF(pdf); 
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(0);
    pdf.text("DEMANDE D'OUVERTURE D'UNE SEPULTURE DE FAMILLE", 105, 40, { align: "center" });
    let y = 55; const x = 15; 
    pdf.setFontSize(10);
    pdf.text("POUR : ", x, y);
    const type = getVal("prestation");
    pdf.rect(x+20, y-4, 5, 5); 
    if(type === "Inhumation") { pdf.setLineWidth(0.5); pdf.line(x+20, y-4, x+25, y+1); pdf.line(x+25, y-4, x+20, y+1); }
    pdf.text("INHUMATION", x+27, y);
    pdf.rect(x+65, y-4, 5, 5); 
    if(type === "Exhumation") { pdf.setLineWidth(0.5); pdf.line(x+65, y-4, x+70, y+1); pdf.line(x+70, y-4, x+65, y+1); }
    pdf.text("EXHUMATION", x+72, y);
    pdf.rect(x+110, y-4, 5, 5); 
    pdf.text("SCELLEMENT D'URNE", x+117, y);
    y += 15;
    pdf.setFont("helvetica", "normal");
    pdf.text("Nous soussignons :", x, y); y+=6;
    pdf.text("> Nom et Prénom : ", x+5, y); 
    pdf.setFont("helvetica", "bold"); 
    pdf.text(`${getVal("civilite_mandant")} ${getVal("soussigne").toUpperCase()}`, x+40, y);
    pdf.setFont("helvetica", "normal");
    pdf.text("Lien de parenté : ", x+110, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(getVal("lien"), x+140, y);
    y += 12;
    pdf.setFont("helvetica", "bold");
    pdf.rect(x, y-3, 2, 2, 'F'); 
    pdf.text("Demandons à faire :", x+5, y); y+=6;
    let actionTxt = "Ouvrir la concession";
    if(type === "Inhumation") actionTxt = "Inhumer dans la concession";
    if(type === "Exhumation") actionTxt = "Exhumer de la concession";
    pdf.text(`${actionTxt} :`, x+5, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`n° ${getVal("num_concession")}`, x+10, y);
    pdf.text(`acquise par : ${getVal("titulaire_concession")}`, x+50, y);
    pdf.text(`(Cimetière : ${getVal("cimetiere_nom")})`, x+130, y);
    y += 12;
    pdf.setFont("helvetica", "bold");
    pdf.rect(x, y-3, 2, 2, 'F');
    pdf.text("Le corps de :", x+5, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text("> M/Mme : ", x+5, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${getVal("civilite_defunt")} ${getVal("nom").toUpperCase()} ${getVal("prenom")}`, x+30, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(`né(e) le ${formatDate(getVal("date_naiss"))} à ${getVal("lieu_naiss")}`, x+110, y);
    y+=6;
    pdf.text("> Qui demeurait à : ", x+5, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(pdf.splitTextToSize(getVal("adresse_fr"), 130), x+40, y);
    y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text("> Décédé(e) le : ", x+5, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`, x+40, y);
    y += 15;
    pdf.setFont("helvetica", "bold"); 
    pdf.rect(x, y-3, 2, 2, 'F'); 
    pdf.text("Mandatons et donnons pouvoir à l'entreprise :", x+5, y); y+=5;
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN", 105, y, {align:"center"}); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    pdf.text("D'exécuter les travaux d'ouverture et fermeture ou scellement d'une urne relatifs à l'opération", x, y); y+=4;
    pdf.text("funéraire ci-dessus mentionnée.", x, y); y+=6;
    pdf.setFontSize(10);
    pdf.text("M : ......................................................", x, y);
    pdf.setFont("helvetica", "bold"); pdf.text("CHERKAOUI MUSTAPHA", x+60, y); y+=5;
    pdf.setFont("helvetica", "normal");
    pdf.text("Pompes Funèbres à ..............................", x, y);
    pdf.setFont("helvetica", "bold"); pdf.text("32 boulevard Léon Jean Grégory Thuir", x+60, y); 
    y += 15;
    pdf.setFont("helvetica", "bold");
    pdf.text("Date et heure de l'inhumation au cimetière :", x, y); y+=8;
    pdf.setFont("helvetica", "normal");
    pdf.text("......................................................................................", x, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${formatDate(getVal("date_inhumation"))} à ${getVal("heure_inhumation")}`, x+20, y-1);
    y += 15;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    const legal = "La présente déclaration dont j'assure la peine et entière responsabilité m'engage à garantir la ville contre toute réclamation qui pourrait survenir suite à l'inhumation/exhumation ou le scellement d'urne qui en fait objet.\n\nEnfin conférèrent à la réglementation en vigueur je m'engage à fournir la preuve de la qualité du ou des ayants droits (livret de famille, acte de naissance, attestation notariée etc.) et déposer ou service Réglementation funéraire de la ville, la copie du ou des document(s) précité prouvant la qualité du ou des ayants droits.";
    const splitLegal = pdf.splitTextToSize(legal, 180);
    pdf.text(splitLegal, x, y);
    y += 35;
    pdf.setFontSize(11);
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, 130, y); y += 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Signature des déclarants", 130, y);
    pdf.save(`Ouverture_Sepulture_${getVal("nom")}.pdf`);
};

window.genererTransport = function(type) {
    if(!logoBase64) chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    const prefix = type === 'avant' ? 'av' : 'ap';
    const labelT = type === 'avant' ? "AVANT MISE EN BIÈRE" : "APRÈS MISE EN BIÈRE";
    pdf.setLineWidth(1); pdf.rect(10, 10, 190, 277); headerPF(pdf);
    pdf.setFillColor(200); pdf.rect(10, 35, 190, 15, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
    pdf.text(`DÉCLARATION DE TRANSPORT DE CORPS`, 105, 42, { align: "center" });
    pdf.setFontSize(12); pdf.text(labelT, 105, 47, { align: "center" });
    let y = 70; const x = 20;
    pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
    pdf.text("TRANSPORTEUR :", x, y); y+=5;
    pdf.setFont("helvetica", "normal");
    pdf.text("PF SOLIDAIRE PERPIGNAN - 32 Bd Léon J. Grégory, Thuir", x, y); y+=15;
    pdf.setDrawColor(0); pdf.rect(x, y, 170, 30); 
    pdf.setFont("helvetica", "bold"); pdf.text("DÉFUNT(E)", x+5, y+6);
    pdf.setFontSize(14); 
    pdf.text(`${getVal("civilite_defunt")} ${getVal("nom")} ${getVal("prenom")}`, 105, y+15, {align:"center"});
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    const phraseEtatCivil = `Né(e) le ${formatDate(getVal("date_naiss"))} à ${getVal("lieu_naiss")}    —    Décédé(e) le ${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`;
    pdf.text(phraseEtatCivil, 105, y+22, {align:"center"}); 
    y+=40; 
    pdf.setLineWidth(0.5); 
    pdf.rect(x, y, 80, 50); 
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text("LIEU DE DÉPART", x+5, y+6);
    pdf.setFont("helvetica", "normal"); pdf.text(getVal(`${prefix}_lieu_depart`), x+5, y+15);
    pdf.setFont("helvetica", "bold"); pdf.text("Date & Heure :", x+5, y+35);
    pdf.setFont("helvetica", "normal"); pdf.text(`${formatDate(getVal(`${prefix}_date_dep`))} à ${getVal(`${prefix}_heure_dep`)}`, x+5, y+42);
    pdf.rect(x+90, y, 80, 50);
    pdf.setFont("helvetica", "bold"); pdf.text("LIEU D'ARRIVÉE", x+95, y+6);
    pdf.setFont("helvetica", "normal"); pdf.text(getVal(`${prefix}_lieu_arrivee`), x+95, y+15);
    pdf.setFont("helvetica", "bold"); pdf.text("Date & Heure :", x+95, y+35);
    pdf.setFont("helvetica", "normal"); pdf.text(`${formatDate(getVal(`${prefix}_date_arr`))} à ${getVal(`${prefix}_heure_arr`)}`, x+95, y+42);
    y+=60;
    const faita = getVal("faita");
    const dateSign = getVal("dateSignature");
    y += 20; 
    pdf.setFont("helvetica", "normal");
    pdf.text(`Fait à ${faita}, le ${formatDate(dateSign)}`, 120, y);
    pdf.setFont("helvetica", "bold");
    pdf.text("Cachet de l'entreprise :", 120, y+10);
    pdf.save(`Transport_${type}_${getVal("nom")}.pdf`);
};

window.genererDemandeFermetureMairie = function() {
    if(!logoBase64) chargerLogoBase64(); const { jsPDF } = window.jspdf; const pdf = new jsPDF(); 
    ajouterFiligrane(pdf); headerPF(pdf);
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(34, 155, 76); pdf.setFontSize(16);
    pdf.text("DEMANDE D'AUTORISATION DE FERMETURE", 105, 45, { align: "center" });
    pdf.text("DE CERCUEIL", 105, 53, { align: "center" });
    let y = 80; const x = 25;
    pdf.setTextColor(0); pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("Je soussigné :", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("• Nom et Prénom : M. CHERKAOUI Mustapha", x+10, y); y+=8;
    pdf.text("• Qualité : Dirigeant PF Solidaire Perpignan", x+10, y); y+=8;
    pdf.text("• Adresse : 32 Bd Léon Jean Grégory, Thuir", x+10, y); y+=15;
    pdf.setFont("helvetica", "bold");
    pdf.text("A l'honneur de solliciter votre autorisation de fermeture du cercueil de :", x, y); y+=15;
    pdf.setFillColor(245, 245, 245); pdf.rect(x-5, y-5, 170, 35, 'F');
    pdf.text("• Nom et Prénom : " + getVal("civilite_defunt") + " " + getVal("nom").toUpperCase() + " " + getVal("prenom"), x+10, y); y+=10;
    pdf.text("• Né(e) le : " + formatDate(getVal("date_naiss")) + " à " + getVal("lieu_naiss"), x+10, y); y+=10;
    pdf.text("• Décédé(e) le : " + formatDate(getVal("date_deces")) + " à " + getVal("lieu_deces"), x+10, y); y+=20;
    pdf.text("Et ce,", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("• Le : " + formatDate(getVal("date_fermeture")), x+10, y); y+=10;
    pdf.text("• A (Lieu) : " + getVal("lieu_mise_biere"), x+10, y); y+=30;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, x, y);
    pdf.save(`Demande_Fermeture_Mairie_${getVal("nom")}.pdf`);
};
