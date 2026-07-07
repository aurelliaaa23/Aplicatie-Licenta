const router = require('express').Router();
const { verificaToken } = require('../middleware/auth.middleware');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const SYSTEM_PROMPT = `Ești asistentul virtual al platformei DGASPC Digital, care ajută cetățenii să depună și
să urmărească dosare administrative (certificat de handicap, alocație de stat, indemnizație creștere copil, adopție).
Răspunde scurt, clar, politicos, exclusiv în limba română.
Poți explica: tipurile de dosare disponibile, documentele necesare pentru fiecare, pașii de depunere,
cum se urmărește statusul unui dosar, cum funcționează programarea la comisie, ce înseamnă fiecare status
(depus, în analiză, programat comisie, aprobat, respins, incomplet).
Dacă întrebarea nu are legătură cu platforma DGASPC sau cu procedurile administrative aferente, spune politicos
că poți ajuta doar cu întrebări despre platformă.
Nu oferi niciodată sfaturi juridice definitive sau diagnostice medicale — pentru cazuri complexe, recomandă
contactarea unui funcționar DGASPC prin intermediul dosarului.`;

// ── POST /api/chatbot/mesaj ──────────────────────────────────────────────
router.post('/mesaj', verificaToken, async (req, res) => {
  try {
    // Asistentul e disponibil DOAR pentru cetățeni
    // Asistentul e disponibil DOAR pentru cetățeni
    if (req.utilizator.Rol?.nume !== 'cetățean') {
      return res.status(403).json({ eroare: 'Asistentul virtual este disponibil doar pentru cetățeni.' });
    }

    const { mesaj, istoric } = req.body;
    if (!mesaj || !mesaj.trim()) return res.status(400).json({ eroare: 'Mesajul nu poate fi gol.' });

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY lipsește din .env');
      return res.status(500).json({ eroare: 'Asistentul virtual nu este configurat momentan.' });
    }

    const contents = [
      { role: 'user',  parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: 'Am înțeles. Sunt gata să ajut cetățenii cu întrebări despre platforma DGASPC.' }] },
      ...(Array.isArray(istoric) ? istoric.slice(-10).map(m => ({
        role: m.rol === 'bot' ? 'model' : 'user',
        parts: [{ text: String(m.text || '').slice(0, 2000) }],
      })) : []),
      { role: 'user', parts: [{ text: mesaj.slice(0, 2000) }] },
    ];

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 2500 },
        }),
      }
    );

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Eroare API Gemini:', data);
      return res.status(502).json({ eroare: 'Asistentul AI nu a putut răspunde momentan. Încercați din nou.' });
    }

    const raspuns = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || 'Nu am putut genera un răspuns. Vă rog reformulați întrebarea.';

    res.json({ raspuns });
  } catch (err) {
    console.error('Eroare chatbot:', err);
    res.status(500).json({ eroare: 'Eroare internă la procesarea mesajului.' });
  }
});

module.exports = router;