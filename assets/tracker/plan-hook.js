/* ANGLE: after a worksheet is sent to the teacher (Web3Forms), also tell the homework tracker, so the task in the student's
   individual plan shows "Suggested" and the score ring. The tracker finds the task by this page's address.
   Reported: worksheets with a score line like "13 / 15 (87%)" (FormData) or JSON with score_percent / score_fraction. Nothing here can break the worksheet itself. */
(function () {
  var URL_ = 'https://script.google.com/macros/s/AKfycbxL4zwd1hopnl_97A_vknNYZJeMhzDa2_wIojqTjAcIiZsgbKVDRWzPXT8xqyv61U30Rg/exec';
  var orig = window.fetch;
  if (!orig) return;
  window.fetch = function (u, o) {
    var p = orig.apply(this, arguments);
    try {
      var body = o && o.body;
      if (typeof u === 'string' && u.indexOf('api.web3forms.com/submit') > -1 && body) {
        var who = '', pts = null, max = null, pct = null;
        if (typeof body.get === 'function') {                      // FormData: score = "13 / 15 (87%)"
          var m = String(body.get('score') || '').match(/(\d+)\s*\/\s*(\d+)\s*\(\s*(\d{1,3})\s*%\s*\)/);
          if (m) { pts = +m[1]; max = +m[2]; pct = +m[3]; }
          who = String(body.get('student') || '').trim();
        } else if (typeof body === 'string' && body.charAt(0) === '{') {   // JSON: score_percent "87%", score_fraction "13/15"
          var j = JSON.parse(body);
          var mp = String(j.score_percent || '').match(/(\d{1,3})/), mf = String(j.score_fraction || '').match(/(\d+)\s*\/\s*(\d+)/);
          if (mp) pct = +mp[1];
          if (mf) { pts = +mf[1]; max = +mf[2]; }
          who = String(j.student_name || j.student || '').trim();
        }
        if (pct != null && who) {
          var meta = document.querySelector('meta[name="ws:title"]');
          p.then(function (r) {
            if (!r || !r.ok) return;
            orig(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ a: 'result', course: 'plan', student: who, hw: (meta && meta.content) || document.title, url: location.pathname, pct: pct, pts: pts, max: max }) }).catch(function () {});
          }).catch(function () {});
        }
      }
    } catch (e) {}
    return p;
  };
})();
