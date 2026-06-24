const { SablonDocument } = require('./models');

async function populeaza() {
  try {
    await SablonDocument.destroy({ where: {} }); 

    const sabloane = [
      {
        nume_sablon: 'Cerere_Evaluare_Handicap',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px; padding: 40px; color: #000; line-height: 1.6;">
            <h3 style="text-align: center; margin-bottom: 40px;">CERERE<br/>pentru evaluarea în vederea încadrării în grad de handicap</h3>
            <p><strong>DOMNULE DIRECTOR,</strong></p>
            <p style="text-align: justify; text-indent: 40px;">
              Subsemnatul/a <strong>{{NUME}} {{PRENUME}}</strong>, CNP <strong>{{CNP}}</strong>, posesor al actului de identitate seria <strong>{{SERIE_CI}}</strong> nr. <strong>{{NUMAR_CI}}</strong>, cu domiciliul în județul <strong>{{JUDET}}</strong>, localitatea <strong>{{ORAS}}</strong>, str. <strong>{{STRADA}}</strong>, telefon <strong>{{TELEFON}}</strong>, e-mail <strong>{{EMAIL}}</strong>.
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Solicit evaluarea în cadrul Serviciului de Evaluare Complexă a Persoanelor Adulte cu Handicap, în vederea: <strong>{{TIP_CERERE}}</strong>.
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Declar pe proprie răspundere că datele declarate în prezenta cerere sunt corecte și complete și că documentele depuse sunt conforme cu originalul. Sunt de acord ca datele mele cu caracter personal să fie prelucrate de DGASPC în conformitate cu reglementările GDPR.
            </p>
            <br/><br/>
            <table style="width: 100%; margin-top: 50px;">
              <tr>
                <td style="width: 50%; vertical-align: top;"><strong>Data:</strong> {{DATA_CURENTA}}</td>
                <td style="width: 50%; text-align: right; vertical-align: bottom;">
                  <strong>Semnătură solicitant:</strong><br/>
                  <img src="{{SEMNATURA_BASE64}}" width="160" style="border-bottom: 1px dashed #000;" />
                </td>
              </tr>
            </table>
          </div>
        `
      },
      {
        nume_sablon: 'Scrisoare_Medic_Familie',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          <div style="font-family: Arial, sans-serif; font-size: 13px; padding: 40px; color: #000; line-height: 1.5;">
            <h2 style="text-align: center; color: #1e2f5c; border-bottom: 2px solid #1e2f5c; padding-bottom: 10px;">SCRISOARE MEDICALĂ (MEDIC DE FAMILIE)</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 5px; border: 1px solid #ccc;"><strong>Nume și Prenume:</strong> {{NUME}} {{PRENUME}}</td><td style="padding: 5px; border: 1px solid #ccc;"><strong>CNP:</strong> {{CNP}}</td></tr>
              <tr><td style="padding: 5px; border: 1px solid #ccc;"><strong>Domiciliu:</strong> {{DOMICILIU}}</td><td style="padding: 5px; border: 1px solid #ccc;"><strong>Telefon:</strong> {{TELEFON}}</td></tr>
            </table>
            <h4 style="background: #f0f4f8; padding: 5px;">1. Anamneza</h4><p>{{ANAMNEZA}}</p>
            <h4 style="background: #f0f4f8; padding: 5px;">2. Diagnostic Principal</h4><p>{{DIAGNOSTIC_PRINCIPAL}}</p>
            <h4 style="background: #f0f4f8; padding: 5px;">3. Diagnostice Secundare</h4><p>{{DIAGNOSTIC_SECUNDAR}}</p>
            <h4 style="background: #f0f4f8; padding: 5px;">4. Internări în spital</h4><ul>{{INTERNARI_HTML}}</ul>
            <h4 style="background: #f0f4f8; padding: 5px;">5. Starea de deplasabilitate</h4><p>{{DEPLASABIL}}</p>
            <div style="text-align: right; margin-top: 40px;">
              <p>Data completării: <strong>{{DATA_CURENTA}}</strong></p>
              <p>Semnătură și parafă medic de familie:</p>
              <img src="{{SEMNATURA_BASE64}}" width="150" />
            </div>
          </div>
        `
      },
      {
        nume_sablon: 'Referat_Medic_Specialist',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          <div style="font-family: Arial, sans-serif; font-size: 13px; padding: 40px; color: #000; line-height: 1.5;">
            <h2 style="text-align: center; color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">REFERAT MEDICAL (MEDIC SPECIALIST)</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 5px; border: 1px solid #ccc;"><strong>Nume și Prenume:</strong> {{NUME}} {{PRENUME}}</td><td style="padding: 5px; border: 1px solid #ccc;"><strong>CNP:</strong> {{CNP}}</td></tr>
              <tr><td style="padding: 5px; border: 1px solid #ccc;"><strong>Domiciliu:</strong> {{DOMICILIU}}</td><td style="padding: 5px; border: 1px solid #ccc;"><strong>Telefon:</strong> {{TELEFON}}</td></tr>
            </table>
            <h4 style="background: #ecfdf5; padding: 5px;">1. Diagnostic de Specialitate</h4><p>{{DIAGNOSTIC}}</p>
            <h4 style="background: #ecfdf5; padding: 5px;">2. Evoluția Bolii</h4><p>{{EVOLUTIE_BOALA}}</p>
            <h4 style="background: #ecfdf5; padding: 5px;">3. Pronostic</h4>
            <ul><li><strong>De viață:</strong> {{PRONOSTIC_VIATA}}</li><li><strong>De vindecare:</strong> {{PRONOSTIC_VINDECARE}}</li></ul>
            <h4 style="background: #ecfdf5; padding: 5px;">4. Tratamente urmate</h4><p>{{TRATAMENTE_URMATE}}</p>
            <h4 style="background: #ecfdf5; padding: 5px;">5. Evaluare terapeutică</h4>
            <ul><li><strong>Răspuns la tratament:</strong> {{RASPUNS_TRATAMENT}}</li><li><strong>Cooperare medic-pacient:</strong> {{COOPERARE}}</li></ul>
            <div style="text-align: right; margin-top: 40px;">
              <p>Data completării: <strong>{{DATA_CURENTA}}</strong></p>
              <p>Semnătură și parafă medic specialist:</p>
              <img src="{{SEMNATURA_BASE64}}" width="150" />
            </div>
          </div>
        `
      },
      {
        nume_sablon: 'Ancheta_Sociala',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          <div style="font-family: Arial, sans-serif; font-size: 12px; padding: 30px; color: #000; line-height: 1.4;">
            <h2 style="text-align: center; color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px;">ANCHETĂ SOCIALĂ</h2>
            <p>Subsemnatul/a, funcționar în cadrul compartimentului Asistență Socială, am efectuat ancheta socială pentru:</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #fafafa;">
              <tr><td style="padding: 5px; border: 1px solid #ddd;"><strong>Nume:</strong> {{NUME}} {{PRENUME}}</td><td style="padding: 5px; border: 1px solid #ddd;"><strong>CNP:</strong> {{CNP}}</td></tr>
              <tr><td style="padding: 5px; border: 1px solid #ddd;"><strong>Domiciliu:</strong> {{DOMICILIU}}</td><td style="padding: 5px; border: 1px solid #ddd;"><strong>Telefon:</strong> {{TELEFON}}</td></tr>
            </table>
            <h4 style="background: #eef2ff; padding: 4px; margin-bottom: 5px;">I. DATE GENERALE</h4>
            <ul style="margin-top:0;">
              <li><strong>Ocupația:</strong> {{OCUPATIA}} | <strong>Studii:</strong> {{STUDII}}</li>
              <li><strong>Stare civilă:</strong> {{STARE_CIVILA}} | <strong>Are copii:</strong> {{COPII}} (Detalii: {{DETALII_COPII}})</li>
              <li><strong>Reprezentant legal:</strong> {{REPREZENTANT_LEGAL}} (Detalii: {{DETALII_REPREZENTANT}})</li>
            </ul>
            <h4 style="background: #eef2ff; padding: 4px; margin-bottom: 5px;">II. AUTONOMIE ȘI ACTIVITĂȚI</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <tr><td style="border: 1px solid #eee; padding: 2px;">Igienă corporală: <b>{{IGIENA_CORPORALA}}</b></td><td style="border: 1px solid #eee; padding: 2px;">Îmbrăcat/Dezbrăcat: <b>{{IMBRACAT_DEZBRACAT}}</b></td></tr>
              <tr><td style="border: 1px solid #eee; padding: 2px;">Servire și hrănire: <b>{{SERVIRE_HRANIRE}}</b></td><td style="border: 1px solid #eee; padding: 2px;">Mobilizare: <b>{{MOBILIZARE}}</b></td></tr>
              <tr><td style="border: 1px solid #eee; padding: 2px;">Deplasare interior: <b>{{DEPLASARE_INTERIOR}}</b></td><td style="border: 1px solid #eee; padding: 2px;">Deplasare exterior: <b>{{DEPLASARE_EXTERIOR}}</b></td></tr>
              <tr><td style="border: 1px solid #eee; padding: 2px;">Dispozitive: <b>{{DISPOZITIVE_DEPLASARE}}</b></td><td style="border: 1px solid #eee; padding: 2px;">Mijloace comunicare: <b>{{COMUNICARE_MIJLOACE}}</b></td></tr>
              <tr><td style="border: 1px solid #eee; padding: 2px;">Preparare hrană: <b>{{PREPARARE_HRANA}}</b></td><td style="border: 1px solid #eee; padding: 2px;">Activități gospodărești: <b>{{ACTIVITATI_GOSPODARESTI}}</b></td></tr>
              <tr><td style="border: 1px solid #eee; padding: 2px;">Gestionare venituri: <b>{{GESTIONARE_VENITURI}}</b></td><td style="border: 1px solid #eee; padding: 2px;">Cumpărături: <b>{{CUMPARATURI}}</b></td></tr>
              <tr><td style="border: 1px solid #eee; padding: 2px;">Admin. tratament: <b>{{ADMINISTRARE_TRATAMENT}}</b></td><td style="border: 1px solid #eee; padding: 2px;">Transport/Timp liber: <b>{{UTILIZARE_TRANSPORT}} / {{TIMP_LIBER}}</b></td></tr>
            </table>
            <h4 style="background: #eef2ff; padding: 4px; margin-bottom: 5px; margin-top: 10px;">III. EVALUARE SENSORIALĂ ȘI COGNITIVĂ</h4>
            <p style="margin:0;">Memorie: <b>{{MEMORIE}}</b> | Acuitate vizuală: <b>{{VAZ}}</b> | Comunicare: <b>{{COMUNICARE}}</b> | Orientare: <b>{{ORIENTARE}}</b> | Comportament: <b>{{COMPORTAMENT}}</b></p>
            <h4 style="background: #eef2ff; padding: 4px; margin-bottom: 5px; margin-top: 10px;">IV. LOCUINȚĂ ȘI MEDIU FAMILIAL</h4>
            <p style="margin:0;">Locuință: <b>{{TIP_LOCUINTA}}</b> ({{NR_CAMERE}} camere) | Încălzire: <b>{{INCALZIRE}}</b> | Apă: <b>{{APA_CURENTA}}</b> | Dotări: <b>{{DOTARI_LOCUINTA}}</b></p>
            <p style="margin:0;">Trăiește: <b>{{COABITARE}}</b> | Coabitant bolnav: <b>{{COABITANT_BOLNAV}}</b> | Adicții: <b>{{COABITANT_ADICTII}}</b></p>
            <p style="margin:0;">Relații cu familia: <b>{{RELATIE_FAMILIE}}</b> | Risc abuz/neglijare: <b>{{RISC_ABUZ}} / {{RISC_NEGLIJARE}}</b></p>
            <p style="margin:0;">Persoană contact urgență: <b>{{PERS_CONTACT}}</b></p>
            <p style="margin:0;">Prieteni: <b>{{ARE_PRIETENI}}</b> ({{RELATII_PRIETENIE}}) | Participare în comunitate: <b>{{PARTICIPARE_COMUNITATE}}</b></p>
            <h4 style="background: #eef2ff; padding: 4px; margin-bottom: 5px; margin-top: 10px;">V. CONCLUZII</h4>
            <p style="margin:0;">{{CONCLUZII}}</p>
            <div style="text-align: right; margin-top: 20px;">
              <p>Data completării: <strong>{{DATA_CURENTA}}</strong></p>
              <img src="{{SEMNATURA_BASE64}}" width="120" />
            </div>
          </div>
        `
      },
      // ⬇️ NOUL ȘABLON ADĂUGAT: CERTIFICATUL DE HANDICAP ⬇️
      {
        nume_sablon: 'Certificat_Incadrare_Handicap',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px; padding: 40px; color: #000; line-height: 1.6;">
            <h2 style="text-align: center; margin-bottom: 5px;">CERTIFICAT</h2>
            <h3 style="text-align: center; margin-top: 0; margin-bottom: 40px;">de încadrare în grad de handicap</h3>
            
            <p style="text-align: justify; margin-bottom: 30px;">
              Comisia de evaluare persoane adulte cu handicap, constituită în temeiul Legii nr.448/2006, privind protecția și promovarea drepturilor persoanelor cu handicap, republicată, cu modificările și completările ulterioare, evaluând dosarul și propunerea serviciului de evaluare complexă a persoanelor adulte cu handicap:
            </p>
            
            <p><strong>Privind pe domnul/doamna:</strong> {{NUME}} {{PRENUME}}</p>
            <p><strong>C.N.P.:</strong> {{CNP}}</p>
            <p><strong>Domiciliul:</strong> Județ {{JUDET}}, Oraș {{ORAS}}</p>
            
            <h4 style="margin-top: 30px; font-size: 15px;">Stabilește următoarele:</h4>
            <p><strong>1. Se încadrează în gradul de handicap:</strong> {{GRAD}}</p>
            <p><strong>2. Valabilitate:</strong> {{VALABILITATE}}</p>
            <p><strong>3. Termen de revizuire:</strong> {{REVIZUIRE}}</p>
            
            <div style="text-align: right; margin-top: 60px;">
              <p style="margin-bottom: 5px;"><strong>Președinte Comisie,</strong></p>
              <p style="font-size: 12px; color: gray;">Semnătură electronică validată în platformă</p>
              <p style="margin-top: 20px;">Data emiterii: <strong>{{DATA_CURENTA}}</strong></p>
            </div>
          </div>
        `
      },
      {
        nume_sablon: 'Cerere_Alocatie_Stat',
        tip_dosar: 'alocatie',
        continut_html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px; padding: 40px; color: #000; line-height: 1.6;">
            <h3 style="text-align: center; margin-bottom: 40px;">CERERE<br/>pentru acordarea Alocației de Stat pentru Copii</h3>
            <p><strong>DOMNULE DIRECTOR,</strong></p>
            <p style="text-align: justify; text-indent: 40px;">
              Subsemnatul/a <strong>{{NUME}} {{PRENUME}}</strong>, CNP <strong>{{CNP}}</strong>, posesor al actului de identitate seria <strong>{{SERIE_CI}}</strong> nr. <strong>{{NUMAR_CI}}</strong>, cu domiciliul în județul <strong>{{JUDET}}</strong>, localitatea <strong>{{ORAS}}</strong>, str. <strong>{{STRADA}}</strong>, telefon <strong>{{TELEFON}}</strong>, e-mail <strong>{{EMAIL}}</strong>, în calitate de reprezentant legal al copilului, solicit prin prezenta acordarea alocației de stat.
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Declar pe proprie răspundere că datele declarate în prezenta cerere sunt corecte și complete. Sunt de acord ca datele mele cu caracter personal să fie prelucrate de DGASPC în conformitate cu reglementările GDPR.
            </p>
            <br/><br/>
            <table style="width: 100%; margin-top: 50px;">
              <tr>
                <td style="width: 50%; vertical-align: top;"><strong>Data:</strong> {{DATA_CURENTA}}</td>
                <td style="width: 50%; text-align: right; vertical-align: bottom;">
                  <strong>Semnătură solicitant:</strong><br/>
                  <img src="{{SEMNATURA_BASE64}}" width="160" style="border-bottom: 1px dashed #000;" />
                </td>
              </tr>
            </table>
          </div>
        `
      },
      {
        nume_sablon: 'Cerere_Indemnizatie',
        tip_dosar: 'indemnizatie',
        continut_html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px; padding: 40px; color: #000; line-height: 1.6;">
            <h3 style="text-align: center; margin-bottom: 40px;">CERERE<br/>pentru acordarea Indemnizației de Creștere a Copilului (0-2 ani)</h3>
            <p><strong>DOMNULE DIRECTOR,</strong></p>
            <p style="text-align: justify; text-indent: 40px;">
              Subsemnatul/a <strong>{{NUME}} {{PRENUME}}</strong>, CNP <strong>{{CNP}}</strong>, domiciliat/ă în <strong>{{JUDET}}, {{ORAS}}, {{STRADA}}</strong>, solicit acordarea indemnizației lunare pentru creșterea copilului.
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Beneficiarul vizat pentru acordarea acestei indemnizații este: <strong>{{BENEFICIAR}}</strong> (Nume partener: {{NUME_SOT}}).
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Confirm îndeplinirea condițiilor legale (inclusiv stagiul de cotizare) și anexez documentele justificative.
            </p>
            <br/><br/>
            <table style="width: 100%; margin-top: 50px;">
              <tr>
                <td style="width: 50%;"><strong>Data:</strong> {{DATA_CURENTA}}</td>
                <td style="width: 50%; text-align: right;">
                  <strong>Semnătură solicitant:</strong><br/>
                  <img src="{{SEMNATURA_BASE64}}" width="160" style="border-bottom: 1px dashed #000;" />
                </td>
              </tr>
            </table>
          </div>
        `
      },
      {
        nume_sablon: 'Adeverinta_Scolara',
        tip_dosar: 'alocatie',
        continut_html: `
          <div style="font-family: Arial, sans-serif; font-size: 13px; padding: 40px; color: #000; line-height: 1.5;">
            <h2 style="text-align: center; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">ADEVERINȚĂ ȘCOLARĂ</h2>
            <p style="text-align: center; font-weight: bold; margin-bottom: 30px;">UNITATEA DE ÎNVĂȚĂMÂNT: {{INSTITUTIE}}</p>
            
            <p style="text-align: justify;">
              Se adeverește prin prezenta că elevul/copilul aflat în grija domnului/doamnei <strong>{{NUME_PARINTE}} {{PRENUME_PARINTE}}</strong> (CNP: {{CNP_PARINTE}}) este înscris la unitatea noastră de învățământ, având următoarea situație școlară:
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px;">
              <tr><td style="padding: 10px; border: 1px solid #ccc;"><strong>Clasa / Grupa:</strong></td><td style="padding: 10px; border: 1px solid #ccc;">{{CLASA}}</td></tr>
              <tr><td style="padding: 10px; border: 1px solid #ccc;"><strong>Media generală / Calificative:</strong></td><td style="padding: 10px; border: 1px solid #ccc;">{{MEDIA}}</td></tr>
              <tr><td style="padding: 10px; border: 1px solid #ccc;"><strong>Număr absențe nemotivate:</strong></td><td style="padding: 10px; border: 1px solid #ccc;">{{NR_ABSENTE}}</td></tr>
            </table>
            
            <p style="font-size: 11px; color: #555;">Prezenta adeverință a fost eliberată pentru a-i servi la dosarul de alocație DGASPC.</p>
            
            <div style="text-align: right; margin-top: 40px;">
              <p>Data emiterii: <strong>{{DATA_CURENTA}}</strong></p>
              <p>Reprezentant unitate ({{TIP_REPREZENTANT}}):</p>
              <img src="{{SEMNATURA_BASE64}}" width="150" />
            </div>
          </div>
        `
      },
      {
        nume_sablon: 'Decizie_Beneficiu_Copil',
        tip_dosar: 'alocatie',
        continut_html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px; padding: 40px; color: #000; line-height: 1.6;">
            <h2 style="text-align: center; margin-bottom: 5px;">DECIZIE DE SOLUȚIONARE</h2>
            <h3 style="text-align: center; margin-top: 0; margin-bottom: 40px;">Dosar nr. {{NUMAR_DOSAR}}</h3>
            
            <p style="text-align: justify; margin-bottom: 30px;">
              În urma analizării documentației depuse și a îndeplinirii criteriilor prevăzute de lege, Departamentul pentru Protecția Copilului a dispus următoarea rezoluție:
            </p>
            
            <p><strong>Privind pe solicitantul:</strong> {{NUME}} {{PRENUME}}</p>
            <p><strong>C.N.P.:</strong> {{CNP}}</p>
            <p><strong>Tip cerere:</strong> {{TIP_DOSAR_FORMATAT}}</p>
            
            <div style="margin-top: 30px; padding: 20px; border: 2px solid {{CULOARE_DECIZIE}}; background-color: {{BG_DECIZIE}};">
              <h4 style="margin: 0; color: {{CULOARE_DECIZIE}}; text-align: center; font-size: 18px;">REZOLUȚIE: {{STATUS_DECIZIE}}</h4>
              <p style="text-align: center; margin-top: 10px;">{{MOTIV_DECIZIE}}</p>
            </div>
            
            <div style="text-align: right; margin-top: 60px;">
              <p style="margin-bottom: 5px;"><strong>Funcționar DGASPC,</strong></p>
              <p style="font-size: 12px; color: gray;">Semnătură electronică validată în platformă</p>
              <p style="margin-top: 20px;">Data emiterii: <strong>{{DATA_CURENTA}}</strong></p>
            </div>
          </div>
        `
      }
    ];

    await SablonDocument.bulkCreate(sabloane);
    console.log("✅ Toate cele 5 Șabloane (inclusiv Certificatul) au fost introduse cu succes!");
    process.exit();
  } catch (err) {
    console.error("❌ Eroare la populare:", err);
    process.exit(1);
  }
}
populeaza();