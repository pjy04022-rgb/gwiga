// 계산식 점검: node tools/check.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { model } = require('../js/model.js');

let fail = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) fail++;
}

// 1) 아무것도 안 마시면 0
const zero = model({ sex: 'm', weight: 70, counts: {}, start: '21:00', end: '01:00', drive: '08:00' });
check('안 마시면 0', zero.atDrive === 0 && zero.peakCon === 0);

// 2) 소주 1.5병 + 생맥주 1잔, 70kg 남성, 21:00~01:00, 08:00 운전
const r = model({ sex: 'm', weight: 70, counts: { soju_b: 1.5, beer_500: 1 }, start: '21:00', end: '01:00', drive: '08:00' });
const grams = 360 * 0.165 * 0.7894 * 1.5 + 500 * 0.045 * 0.7894;
check('순알코올 g', Math.abs(r.grams - grams) < 1e-9, r.grams.toFixed(1) + 'g');
const peakCon = grams * 0.7 / (0.6 * 70 * 10);
check('보수적 최고 농도', Math.abs(r.peakCon - peakCon) < 1e-9, r.peakCon.toFixed(3) + '%');
check('운전 시각 = 7시간 뒤', r.d - r.e === 7 * 60);
check('운전 시각 농도', Math.abs(r.atDrive - Math.max(0, peakCon - 0.008 * 7)) < 1e-9, r.atDrive.toFixed(3) + '%');
check('보수적 추정 ≥ 평균 추정', r.atDrive >= r.atDriveAvg, r.atDriveAvg.toFixed(3) + '%');

// 3) 여성은 같은 조건에서 더 높게
const f = model({ sex: 'f', weight: 70, counts: { soju_b: 1.5, beer_500: 1 }, start: '21:00', end: '01:00', drive: '08:00' });
check('여성 추정이 더 높음', f.atDrive > r.atDrive);

// 4) 자정을 넘기는 시각 처리
const late = model({ sex: 'm', weight: 70, counts: { soju_b: 1 }, start: '23:00', end: '02:00', drive: '01:00' });
check('운전 시각이 마지막 잔보다 이르면 다음 날', late.d > late.e && late.d - late.e === 23 * 60);

// 5) 농도는 음수가 되지 않음
const small = model({ sex: 'm', weight: 90, counts: { beer_can: 1 }, start: '20:00', end: '21:00', drive: '09:00' });
check('음수 없음', small.atDrive === 0);

// ---------- 모임 모드 규칙 ----------
const L = require('../js/group-logic.js');
const base = { keyTo: null, keyConfirmed: false, daeriMet: false, home: false };
const noCar = { ...base, nick: '민수', method: '택시', car: 'n' };
const car = { ...base, nick: '태호', method: '택시', car: 'y' };
const daeri = { ...base, nick: '지현', method: '대리운전', car: 'y' };

check('차 없으면 바로 확인됨', L.status(noCar) === 'ok');
check('차 가져오면 미확인', L.status(car) === 'pending');
check('키 맡기면 확인 대기(여전히 미확인)', L.status({ ...car, keyTo: 'x' }) === 'key-wait' && L.isUnresolved('key-wait'));
check('친구가 받으면 확인', L.status({ ...car, keyTo: 'x', keyConfirmed: true }) === 'key');
check('대리운전은 기사 만나야 확인', L.status(daeri) === 'pending' && L.status({ ...daeri, daeriMet: true }) === 'daeri');
check('택시인데 daeriMet만으로는 확인 안 됨', L.status({ ...car, daeriMet: true }) === 'pending');
check('미확인은 귀가 완료 불가', !L.canGoHome(car, true));
check('끝나기 전에는 귀가 완료 불가', !L.canGoHome(noCar, false) && L.canGoHome(noCar, true));
check('끝나기 전 마무리 불가', L.closeBlock([noCar], false) !== '');
check('미확인 있으면 마무리 불가', /1대/.test(L.closeBlock([noCar, car], true)));
check('모두 확인되면 마무리 가능', L.closeBlock([noCar, { ...car, keyConfirmed: true }], true) === '');
const sum = L.summary([noCar, car, { ...daeri, daeriMet: true }]);
check('요약 집계', sum.total === 3 && sum.cars === 2 && sum.unresolved === 1 && sum.unresolvedNicks[0] === '태호');
check('참가: 세 항목 모두 필요', L.validateJoin({ nick: '', method: '', car: '' }, []).length === 3);
check('참가: 같은 별명 거부', L.validateJoin({ nick: '민수', method: '택시', car: 'n' }, [noCar]).length === 1);
check('참가: 올바른 입력 통과', L.validateJoin({ nick: ' 새 친구 ', method: '걸어서', car: 'n' }, [noCar]).length === 0);
check('모임 코드 6자리', /^[A-Z2-9]{6}$/.test(L.makeCode()));
check('자정 넘는 모임 끝 시각', L.endAt({ date: '2026-11-13', start: '21:00', end: '01:00' }) - new Date('2026-11-13T21:00').getTime() === 4 * 3600000);

console.log(fail ? `\n${fail}개 실패` : '\n모두 통과');
process.exit(fail ? 1 : 0);
