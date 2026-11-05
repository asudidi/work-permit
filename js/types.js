/*
 * 안전작업허가서 종류 정의 (사내 양식 RV6 「발급, 입회, 승인」 기준)
 *
 * 새 허가서 종류를 추가하려면 아래 배열에 항목 하나를 복사해 붙여넣고 고치면 됩니다.
 *  - id        : 영문 고유값 (다른 허가서의 보충/관련 칸에서 이 id로 연결됩니다)
 *  - checks    : 안전조치 요구사항. 열(column) 단위 배열이며 title 은 생략 가능
 *  - special   : 기타 특별 요구사항 기본 문구
 *  - sideBox   : 특별요구사항 오른쪽 칸 — 'attachments' | 'responsible' | 'cutoff'
 *  - gas       : 산소·유해가스 측정표 포함 여부
 *  - completion: 'work'(작업 완료 확인) | 'power'(전원 복구)
 *  - sketch    : 도면 칸 { label } — 이미지 첨부 + 첨부도면 No.(extra.drawingNos)
 *  - checksLabel    : 체크 항목 제목 (기본 '안전조치요구사항')
 *  - checkConfirmer : true 이면 항목마다 확인자 서명란 (굴착)
 */
(function () {
  const SUPPLEMENT = {
    label: '보충 작업 허가서',
    items: [
      { id: 'confined', label: '밀폐공간출입 허가' },
      { id: 'excavation', label: '굴착작업 허가' },
      { id: 'power', label: '정전작업 허가' },
      { id: 'heavy', label: '중장비작업 허가' },
      { id: 'height', label: '고소작업 허가' },
      { id: 'radiation', label: '방사선작업 허가' }
    ]
  };
  const RELATED = {
    label: '관련 작업 허가서',
    items: [
      { id: 'hot', label: '화기작업 허가' },
      { id: 'general', label: '일반위험작업 허가' }
    ]
  };
  const ATTACHMENTS = [
    '차단밸브 및 맹판설치 위치표시 도면',
    '소화기 목록',
    '소요안전장구 목록',
    '특수작업절차서',
    '보충작업허가서'
  ];
  // 측정 기기명은 목록에서 선택 — 기기가 늘면 options에 추가
  const GAS_FIELDS = [
    { key: 'gasMeter', label: '측정 기기명', type: 'select', options: ['복합가스측정기', 'TD-11'], default: '복합가스측정기' },
    { key: 'measurer', label: '측정인', default: '' }
  ];

  window.PERMIT_TYPES = [
    {
      id: 'hot',
      name: '화기작업 허가서',
      short: '화기',
      color: '#c2410c',
      locationLabel: '작업장소 및 설비',
      linked: SUPPLEMENT,
      checks: [
        { items: ['작업구역 설정(출입경고 표지)', '가스농도 측정', '밸브차단 및 차단표지부착', '맹판설치 및 표지부착', '용기개방 및 압력방출', '위험물질방출 및 처리', '용기내부 세정 및 처리', '불활성가스 치환 및 환기'] },
        { items: ['비산불티차단막 설치', '정전/잠금/표지부착', '환기장비', '조명장비', '소화기', '안전장구', '안전교육', '운전요원의 입회'] }
      ],
      special: '1. 화기 및 화재 위험이 있으니 안전장구 및 보호구 착용\n2. 용접 작업 시 소화기 비치 요망\n3. 용접 작업 시 환기 작업 할 것\n4. 화재 감시인 배치 할 것',
      sideBox: 'attachments',
      attachments: ATTACHMENTS,
      gas: true,
      watcherLabel: '화재 감시인',
      extraFields: GAS_FIELDS.concat([{ key: 'watcher', label: '화재 감시인', default: '' }]),
      completion: 'work'
    },
    {
      id: 'general',
      name: '일반위험작업 허가서',
      short: '일반위험',
      color: '#a16207',
      locationLabel: '작업장소 및 설비',
      linked: SUPPLEMENT,
      checks: [
        { items: ['작업구역 설정(출입경고 표지)', '가스 농도 측정', '분진 농도 측정', '밸브차단 및 차단표지부착', '맹판설치 및 표지부착', '용기개방 및 압력방출', '위험물질방출 및 처리', '용기내부 세정 및 처리', '불활성가스 치환 및 환기'] },
        { items: ['정전/잠금/표지부착', '환기장비', '조명장비', '소화기', '안전장구', '안전교육', '운전요원의 입회'] }
      ],
      special: '',
      sideBox: 'attachments',
      attachments: ATTACHMENTS,
      gas: false,
      completion: 'work'
    },
    {
      id: 'power',
      name: '정전작업 허가서',
      short: '정전',
      color: '#1d4ed8',
      locationLabel: '전기차단이 요구되는 기기',
      midColumn: { label: '제어실 차단기 번호', key: 'breaker' },
      linked: RELATED,
      checks: [
        { title: '제어반', items: ['주 차단 스위치 차단', '제어차단기 내림', '차단기 잠금장치', '시험전원 차단', '차단표시판 부착'] },
        { title: '현장기기', items: ['현장스위치 차단', '차단표시판 부착'] }
      ],
      special: '1. 잠금장치의 열쇠보관 및 담당자 관리 철저\n2. 작업자/운전자/전기담당자의 통신수단 확보',
      sideBox: 'cutoff',
      gas: false,
      extraFields: [{ key: 'breaker', label: '제어실 차단기 번호', type: 'textarea', placeholder: '예) 354-M-HV-103A/B : 1MC06-19, 20' }],
      completion: 'power'
    },
    {
      id: 'heavy',
      name: '중장비작업 허가서',
      short: '중장비',
      color: '#4d7c0f',
      locationLabel: '작업장소 및 투입장비',
      linked: RELATED,
      checks: [
        { items: ['기상상태', '신호수배치', '조명설비', '통행금지표시판', '전원설비 간섭여부'] },
        { items: ['매트등 부속장구', '노면상태', '중장비 검사증', '중장비 시운전'] }
      ],
      special: 'o 자격증 소지 여부\no 보험증',
      sideBox: 'responsible',
      gas: false,
      extraFields: [{ key: 'machine', label: '투입장비', placeholder: '예) 25톤 크레인 1대' }],
      completion: 'work'
    },
    {
      id: 'confined',
      name: '밀폐공간출입 허가서',
      short: '밀폐공간',
      color: '#7e22ce',
      locationLabel: '작업장소 및 설비',
      linked: RELATED,
      checks: [
        { items: ['밸브차단 및 차단표식부착', '가스농도 측정', '맹판설치 및 표지부착', '압력방출', '용기세착 후 공기/물 치환 및 환기', '산소농도 측정'] },
        { items: ['정전/잠금/표지부착', '환기장비', '조명장비', '소화기', '안전장구(구조용로프 등)', '안전교육', '운전요원의 입회'] }
      ],
      special: '1. 보호장비 구비 및 착용\n2. 작업 전 환기 실시\n3. 질식재해 예방교육 실시',
      sideBox: 'attachments',
      attachments: ATTACHMENTS.slice(0, 4),
      gas: true,
      watcherLabel: '감시인 확인',
      extraFields: GAS_FIELDS.concat([{ key: 'watcher', label: '감시인', default: '' }]),
      completion: 'work'
    },
    {
      id: 'height',
      name: '고소작업 허가서',
      short: '고소',
      color: '#0f766e',
      locationLabel: '작업장소 및 설비',
      linked: RELATED,
      checks: [
        { items: ['작업에 적합한 작업발판 및 안전난간설치 여부', '안전대 착용 및 부착 여부', '추락 방지용 방망 설치 여부', '비계설치 : 비계, 클램프, 방망의 파손유무', '고소작업대 사용'] }
      ],
      special: '',
      sideBox: 'responsible',
      gas: false,
      completion: 'work'
    },
    {
      id: 'excavation',
      name: '굴착작업 허가서',
      short: '굴착',
      color: '#92400e',
      locationLabel: '작업장소 및 설비',
      linked: RELATED,
      sketch: { label: '굴착도 스케치' },
      checksLabel: '관련설비별 확인사항',
      checkConfirmer: true,
      checks: [
        { items: ['기계배관 관련 확인사항 : 지하배관 유무', '소방관련 확인사항 : 소방배관 배출구 유무', '전기관련 확인사항 : 전기동력선 유무', '계장관련 확인사항 : 제어용케이블 유무', '기타관련 확인사항 : 전화선 접지선 유무'] }
      ],
      special: '',
      sideBox: 'responsible',
      gas: false,
      extraFields: [{ key: 'drawingNos', label: '첨부도면 No.', type: 'textarea', placeholder: '예) ANS-2D-C-CD-791-001-B : 지하매설물 계획 평면도(1/2)' }],
      completion: 'work'
    },
    {
      id: 'radiation',
      name: '방사선작업 허가서',
      short: '방사선',
      color: '#be123c',
      locationLabel: '작업장소 및 설비',
      linked: RELATED,
      sketch: { label: '방사선 방사점 도면' },
      checksLabel: '안전조치 확인사항',
      checks: [
        { items: ['작업구역에 차단선 설치', '제한구역의 비인가자 출입제한', '방사선 위험표시', '경고등 (점멸등)'] }
      ],
      special: 'o 자격증 소지 여부',
      sideBox: 'responsible',
      gas: false,
      extraFields: [{ key: 'drawingNos', label: '첨부도면 No.', type: 'textarea', placeholder: '방사점 위치 도면 번호' }],
      completion: 'work'
    }
  ];
})();
