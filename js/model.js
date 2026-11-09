/* 숙취 계산식 (위드마크) — 화면과 분리된 순수 함수. node tools/check.mjs 로 점검한다. */
(function (root) {
  var DRINKS = [
    { id: 'soju_b', name: '소주', unit: '병', ml: 360, abv: 16.5, step: 0.5 },
    { id: 'soju_g', name: '소주', unit: '잔', ml: 50, abv: 16.5, step: 1 },
    { id: 'beer_500', name: '생맥주', unit: '500cc', ml: 500, abv: 4.5, step: 1 },
    { id: 'beer_can', name: '맥주', unit: '캔 355ml', ml: 355, abv: 4.5, step: 1 },
    { id: 'makgeolli', name: '막걸리', unit: '병 750ml', ml: 750, abv: 6, step: 0.5 },
    { id: 'wine', name: '와인', unit: '잔 150ml', ml: 150, abv: 12.5, step: 1 },
    { id: 'whisky', name: '위스키', unit: '샷 30ml', ml: 30, abv: 40, step: 1 }
  ];

  var P = {
    density: 0.7894,      // 에탄올 밀도 g/ml
    absorb: 0.7,          // 체내흡수율
    r: { m: 0.7, f: 0.6 },// 위드마크 계수(평균)
    rCut: 0.1,            // 보수적 추정에서 낮추는 값
    betaAvg: 0.015,       // 시간당 분해량(평균) %
    betaCon: 0.008        // 시간당 분해량(분해 느린 사람) %
  };

  function mins(v) { var p = (v || '00:00').split(':'); return (+p[0]) * 60 + (+p[1]); }

  /* input: {sex:'m'|'f', weight:kg, counts:{id:수량}, start:'HH:MM', end:'HH:MM', drive:'HH:MM'} */
  function model(input) {
    var w = Math.max(30, +input.weight || 70);
    var grams = DRINKS.reduce(function (s, d) { return s + d.ml * (d.abv / 100) * P.density * (+input.counts[d.id] || 0); }, 0);
    var absorbed = grams * P.absorb;
    var rAvg = P.r[input.sex] || P.r.m, rCon = rAvg - P.rCut;
    var peakAvg = absorbed / (rAvg * w * 10), peakCon = absorbed / (rCon * w * 10);

    var s = mins(input.start), e = mins(input.end); if (e < s) e += 1440;
    var d = mins(input.drive); while (d <= e) d += 1440;

    function bac(t, peak, beta) {
      if (t <= s) return 0;
      if (t <= e) return e === s ? peak : peak * (t - s) / (e - s);
      return Math.max(0, peak - beta * (t - e) / 60);
    }
    return {
      grams: grams, s: s, e: e, d: d,
      peakAvg: peakAvg, peakCon: peakCon, betaAvg: P.betaAvg, betaCon: P.betaCon,
      atDrive: bac(d, peakCon, P.betaCon),
      atDriveAvg: bac(d, peakAvg, P.betaAvg),
      t03: peakCon > 0.03 ? e + (peakCon - 0.03) / P.betaCon * 60 : null,
      t0: e + peakCon / P.betaCon * 60,
      bac: bac
    };
  }

  var api = { DRINKS: DRINKS, PARAMS: P, model: model };
  root.GwigaModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
