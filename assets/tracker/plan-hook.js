/* ANGLE: after a worksheet is sent to the teacher (Web3Forms), also tell the homework tracker, so the task in the student's
   individual plan shows "Suggested" and the score ring. The tracker finds the task by this page's address.
   Only worksheets with a score line like "13 / 15 (87%)" are reported. Nothing here can break the worksheet itself. */
(function () {
  var URL_ = 'https://script.google.com/macros/s/AKfycbxL4zwd1hopnl_97A_vknNYZJeMhzDa2_wIojqTjAcIiZsgbKVDRWzPXT8xqyv61U30Rg/exec';
  var orig = window.fetch;
  if (!orig) return;
  window.fetch = function (u, o) {
    var p = orig.apply(this, arguments);
    try {
      var body = o && o.body;
      if (typeof u === 'string' && u.indexOf('api.web3forms.com/submit') > -1 && body && typeof body.get === 'function') {
        var m = String(body.get('score') || '').match(/(\d+)\s*\/\s*(\d+)\s*\(\s*(\d{1,3})\s*%\s*\)/);
        var who = String(body.get('student') || '').trim();
        if (m && who) {
          var meta = document.querySelector('meta[name="ws:title"]');
          p.then(function (r) {
            if (!r || !r.ok) return;
            orig(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ a: 'result', course: 'plan', student: who, hw: (meta && meta.content) || document.title, url: location.pathname, pct: +m[3], pts: +m[1], max: +m[2] }) }).catch(function () {});
          }).catch(function () {});
        }
      }
    } catch (e) {}
    return p;
  };
})();
