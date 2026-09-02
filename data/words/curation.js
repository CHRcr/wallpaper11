'use strict';

const wordList = (value) => value.trim().split(/\s+/);

/*
 * Human-reviewed corrections and additions.
 *
 * This is the authoritative place for semantic decisions that cannot be made
 * safely from spelling alone. The runtime file in app/js is generated; do not
 * put hand-written corrections there.
 */

module.exports = {
  version: '2026.09.02',

  // Qingbei-track extension: 101 manually reviewed academic and reading words
  // bring the runtime from 3399 unique base entries to 3500 drawable entries.
  newEntries: [
    { word: 'analyse', meanings: ['v. 分析'] },
    { word: 'anticipate', meanings: ['v. 预料；预期；期待'] },
    { word: 'arise', meanings: ['vi. 出现；发生；起身'], forms: [
      { label: '过去式', value: 'arose' },
      { label: '过去分词', value: 'arisen' },
      { label: '现在分词', value: 'arising' },
    ] },
    { word: 'capacity', meanings: ['n. 能力；容量；容纳量'] },
    { word: 'cease', meanings: ['v. 停止；终止'] },
    { word: 'cite', meanings: ['v. 引用；引证；提及'] },
    { word: 'collapse', meanings: ['v. 倒塌；崩溃；n. 倒塌；崩溃'] },
    { word: 'considerable', meanings: ['adj. 相当大的；重要的'] },
    { word: 'context', meanings: ['n. 上下文；背景；语境'] },
    { word: 'contract', meanings: ['n. 合同；契约；v. 收缩；感染'] },
    { word: 'contrast', meanings: ['n. 对比；对照；v. 对比'] },
    { word: 'cooperate', meanings: ['vi. 合作；协作'] },
    { word: 'coordinate', meanings: ['v. 协调；使相配合；n. 坐标'] },
    { word: 'core', meanings: ['n. 核心；要点；果核'] },
    { word: 'crucial', meanings: ['adj. 至关重要的；决定性的'] },
    { word: 'define', meanings: ['v. 定义；界定；阐明'] },
    { word: 'demonstrate', meanings: ['v. 证明；展示；示范'] },
    { word: 'deny', meanings: ['v. 否认；拒绝给予'], forms: [
      { label: '过去式 / 过去分词', value: 'denied' },
      { label: '现在分词', value: 'denying' },
    ] },
    { word: 'depression', meanings: ['n. 沮丧；抑郁；萧条；凹陷'] },
    { word: 'derive', meanings: ['v. 获得；起源于；推导出'] },
    { word: 'deserve', meanings: ['v. 值得；应得'] },
    { word: 'detect', meanings: ['v. 发现；察觉；探测'] },
    { word: 'device', meanings: ['n. 装置；设备；手段'] },
    { word: 'discipline', meanings: ['n. 纪律；训练；学科；v. 约束'] },
    { word: 'discriminate', meanings: ['v. 区分；辨别；歧视'] },
    { word: 'domestic', meanings: ['adj. 国内的；家庭的；家养的'] },
    { word: 'dominate', meanings: ['v. 支配；占主导；俯视'] },
    { word: 'economy', meanings: ['n. 经济；节约；经济体'] },
    { word: 'efficient', meanings: ['adj. 高效的；有能力的'] },
    { word: 'eliminate', meanings: ['v. 消除；淘汰；排除'] },
    { word: 'emerge', meanings: ['vi. 出现；显露；兴起'] },
    { word: 'emphasize', meanings: ['v. 强调；着重'] },
    { word: 'encounter', meanings: ['v. 遭遇；邂逅；n. 遭遇'] },
    { word: 'engage', meanings: ['v. 参加；吸引；雇用；使订婚'] },
    { word: 'enhance', meanings: ['v. 提高；增强；改善'] },
    { word: 'ensure', meanings: ['v. 确保；保证'] },
    { word: 'equivalent', meanings: ['adj. 等同的；等值的；n. 对应物'] },
    { word: 'establish', meanings: ['v. 建立；确立；证实'] },
    { word: 'estimate', meanings: ['v. 估计；估算；n. 估计'] },
    { word: 'evolve', meanings: ['v. 进化；逐步发展'] },
    { word: 'exceed', meanings: ['v. 超过；超越'] },
    { word: 'exclude', meanings: ['v. 排除；不包括；阻止进入'] },
    { word: 'exhibit', meanings: ['v. 展示；表现；n. 展品'] },
    { word: 'extend', meanings: ['v. 延伸；扩大；提供'] },
    { word: 'external', meanings: ['adj. 外部的；外来的；外界的'] },
    { word: 'factor', meanings: ['n. 因素；要素；因子'] },
    { word: 'feature', meanings: ['n. 特征；特色；v. 以……为特色'] },
    { word: 'foundation', meanings: ['n. 基础；基金会；建立'] },
    { word: 'generate', meanings: ['v. 产生；引起；发电'] },
    { word: 'highlight', meanings: ['v. 突出；强调；n. 最精彩部分'] },
    { word: 'hypothesis', meanings: ['n. 假设；假说'], forms: [
      { label: '复数', value: 'hypotheses' },
    ] },
    { word: 'identify', meanings: ['v. 识别；确认；认同'] },
    { word: 'illustrate', meanings: ['v. 说明；阐明；给……加插图'] },
    { word: 'imply', meanings: ['v. 暗示；意味着'] },
    { word: 'impose', meanings: ['v. 强加；征收；使……承受'] },
    { word: 'incentive', meanings: ['n. 激励；刺激；动机'] },
    { word: 'inevitable', meanings: ['adj. 不可避免的；必然发生的'] },
    { word: 'infer', meanings: ['v. 推断；推论'], forms: [
      { label: '过去式 / 过去分词', value: 'inferred' },
      { label: '现在分词', value: 'inferring' },
    ] },
    { word: 'innovate', meanings: ['v. 创新；革新'] },
    { word: 'instance', meanings: ['n. 例子；情况；实例'] },
    { word: 'integrate', meanings: ['v. 融合；使一体化'] },
    { word: 'interact', meanings: ['vi. 互动；相互作用'] },
    { word: 'interpret', meanings: ['v. 解释；理解；口译'] },
    { word: 'invest', meanings: ['v. 投资；投入'] },
    { word: 'involve', meanings: ['v. 涉及；包含；使参与'] },
    { word: 'issue', meanings: ['n. 问题；议题；发行物；v. 发布'] },
    { word: 'justify', meanings: ['v. 证明……正当；为……辩护'] },
    { word: 'launch', meanings: ['v. 发射；发起；推出；n. 发射'] },
    { word: 'maintain', meanings: ['v. 维持；保养；坚持认为'] },
    { word: 'manipulate', meanings: ['v. 操纵；熟练处理；篡改'] },
    { word: 'mechanism', meanings: ['n. 机制；机械装置'] },
    { word: 'minor', meanings: ['adj. 较小的；次要的；n. 未成年人'] },
    { word: 'modify', meanings: ['v. 修改；调整；修饰'] },
    { word: 'motive', meanings: ['n. 动机；目的'] },
    { word: 'objective', meanings: ['n. 目标；adj. 客观的'] },
    { word: 'option', meanings: ['n. 选择；可选项'] },
    { word: 'organize', meanings: ['v. 组织；安排；使有条理'] },
    { word: 'perceive', meanings: ['v. 察觉；理解；认为'] },
    { word: 'perspective', meanings: ['n. 观点；视角；透视法'] },
    { word: 'priority', meanings: ['n. 优先事项；优先权'] },
    { word: 'proceed', meanings: ['vi. 继续进行；前往；着手'] },
    { word: 'propose', meanings: ['v. 提议；建议；打算；求婚'] },
    { word: 'prospect', meanings: ['n. 前景；可能性；景象'] },
    { word: 'psychological', meanings: ['adj. 心理的；心理学的'] },
    { word: 'pursue', meanings: ['v. 追求；追赶；继续从事'] },
    { word: 'regulate', meanings: ['v. 管理；调节；控制'] },
    { word: 'relevant', meanings: ['adj. 有关的；切题的'] },
    { word: 'relieve', meanings: ['v. 减轻；缓解；解除'] },
    { word: 'resolve', meanings: ['v. 解决；决定；n. 决心'] },
    { word: 'restrict', meanings: ['v. 限制；约束'] },
    { word: 'retain', meanings: ['v. 保留；保持；记住'] },
    { word: 'reveal', meanings: ['v. 揭示；透露；显示'] },
    { word: 'significant', meanings: ['adj. 重要的；显著的；有意义的'] },
    { word: 'source', meanings: ['n. 来源；源头；资料来源'] },
    { word: 'strategy', meanings: ['n. 策略；战略'] },
    { word: 'structure', meanings: ['n. 结构；构造；v. 组织'] },
    { word: 'sufficient', meanings: ['adj. 足够的；充分的'] },
    { word: 'summarize', meanings: ['v. 总结；概括'] },
    { word: 'transmit', meanings: ['v. 传输；传播；传染'] },
    { word: 'vary', meanings: ['v. 变化；相异；改变'] },
    { word: 'virtual', meanings: ['adj. 虚拟的；事实上的；几乎完全的'] },
  ],

  // Difficulty is a learning priority, not an automatic spelling heuristic.
  // challenge is a reviewed subset of advanced and therefore receives a
  // stronger bonus while every core entry keeps a positive base weight.
  difficultyAssignments: {
    advanced: wordList(`
      abandon abolish abnormal abrupt absurd abundant abuse academic accelerate accommodation
      accomplish accumulate accurate acknowledge acquaintance acquire acute adapt adequate
      adjust administration advocate affection agency aggressive allocate alternative ambition
      analyse ancestor annual anticipate anxiety apparent appeal appetite application appoint
      appreciate appropriate approve arise artificial aspect assess associate assumption atmosphere
      attach attain attitude authority automatic available average aware barrier behalf benefit
      boundary brief budget burden calculate candidate capacity category caution cease challenge
      circumstance cite civil clarify collapse colleague combine comment commercial commit communicate
      compare compensate compete complex component concentrate concept conclude concrete conduct conflict
      consequence considerable consist constant construct consult consume contain contemporary content
      context contract contrast contribute controversial convince cooperate coordinate core correspond
      crucial culture decline define demonstrate deny depression derive deserve detect detective determine
      device devote differ discipline discriminate dismiss distinguish distribute diverse domestic dominate
      economy efficient eliminate emerge emphasize encounter engage enhance ensure enterprise environment
      equivalent establish estimate evaluate evident evolve exceed exclude exhibit expand expectation expose
      extend external factor feature finance flexible focus foundation function fundamental generate guarantee
      highlight hypothesis identify illustrate imply impose incentive incident indicate inevitable infer influence
      initial innovate inspect inspire instance institute integrate intend interact interpret interrupt invest
      involve issue justify launch legal maintain major manipulate measure mechanism mental method minor modify
      motive negotiate objective obtain occur oppose option ordinary organize outcome participate perceive
      perspective phenomenon policy potential predict preserve principle priority proceed process profession
      prohibit promote propose prospect psychological pursue range react recover reduce reference reflect reform
      regulate reject relevant relieve rely remove require resolve restrict retain reveal revolution significant
      similar source specific stable strategy structure submit substitute sufficient summarize survive target
      technique temporary tendency theory transform transmit trend undertake unique valid vary version virtual
      vital welfare withdraw
    `),
    challenge: wordList(`
      abolish abrupt absurd accumulate acknowledge acquaintance acquire acute adequate advocate allocate ambition
      anticipate anxiety apparent appropriate assess attain authority barrier burden cease circumstance cite clarify
      collapse compensate complex component concept concrete conflict considerable consist constant contemporary
      context contrast controversial coordinate correspond crucial decline demonstrate depression derive discriminate
      dismiss distinguish distribute diverse domestic dominate eliminate emerge emphasize encounter enhance ensure
      enterprise equivalent establish estimate evaluate evident evolve exceed exclude exhibit expose external flexible
      fundamental generate guarantee hypothesis imply impose incentive incident inevitable infer initial innovate inspect
      instance institute integrate interpret invest justify manipulate mechanism modify negotiate objective obtain oppose
      outcome perceive perspective phenomenon potential preserve principle priority proceed prohibit prospect psychological
      pursue reference reflect reform regulate relevant restrict retain reveal revolution significant specific stable
      strategy structure substitute sufficient technique temporary tendency theory transform transmit trend undertake valid
      vary virtual vital welfare withdraw
    `),
  },

  entryOverrides: {
    AD: {
      id: 'AD_anno_domini',
      meanings: ['n. 公元'],
      forms: [],
    },
    ad: {
      id: 'ad_advertisement',
      meanings: ['n. 广告'],
    },
    Miss: {
      id: 'Miss_title',
      meanings: ['n. 小姐；女士'],
    },
    miss: {
      id: 'miss_verb',
      meanings: ['v. 错过；想念；未击中'],
    },
    ambition: {
      meanings: ['n. 雄心；抱负；野心'],
    },
    detective: {
      meanings: ['n. 侦探；adj. 侦探的'],
    },
    charge: {
      meanings: ['n. 费用；主管；负责；指控；电荷；v. 收费；控告；猛冲；充电'],
    },
    break: {
      meanings: ['n. 间歇；休息；裂口；v. 打破；折断；损坏；违反'],
      forms: [
        { label: '过去式', value: 'broke' },
        { label: '过去分词', value: 'broken' },
        { label: '现在分词', value: 'breaking' },
        { label: '第三人称单数 / 复数', value: 'breaks' },
      ],
    },
    can: {
      meanings: ['modal v. 能；可以；可能；n. 罐；罐头'],
      forms: [
        { label: '过去式（情态动词）', value: 'could' },
        { label: '复数（名词）', value: 'cans' },
      ],
    },
    content: {
      meanings: ['n. 内容；目录；adj. 满足的；满意的'],
      forms: [{ label: '复数（名词）', value: 'contents' }],
    },
    drink: {
      meanings: ['n. 饮料；酒；v. 喝；饮'],
      forms: [
        { label: '过去式', value: 'drank' },
        { label: '过去分词', value: 'drunk' },
        { label: '现在分词', value: 'drinking' },
        { label: '第三人称单数 / 复数', value: 'drinks' },
      ],
    },
    fair: {
      meanings: ['adj. 公平的；合理的；白皙的；n. 集市；展览会'],
      forms: [
        { label: '比较级', value: 'fairer' },
        { label: '最高级', value: 'fairest' },
        { label: '复数（名词）', value: 'fairs' },
      ],
    },
    fight: {
      meanings: ['n. 战斗；打架；争论；v. 战斗；搏斗；反对'],
      forms: [
        { label: '过去式 / 过去分词', value: 'fought' },
        { label: '现在分词', value: 'fighting' },
        { label: '第三人称单数 / 复数', value: 'fights' },
      ],
    },
    fine: {
      meanings: ['adj. 美好的；晴朗的；细的；健康的；n. 罚款；v. 罚款'],
      forms: [
        { label: '比较级', value: 'finer' },
        { label: '最高级', value: 'finest' },
        { label: '过去式 / 过去分词', value: 'fined' },
        { label: '现在分词', value: 'fining' },
        { label: '第三人称单数 / 复数', value: 'fines' },
      ],
    },
    firm: {
      meanings: ['n. 公司；企业；adj. 坚固的；坚定的'],
      forms: [
        { label: '比较级', value: 'firmer' },
        { label: '最高级', value: 'firmest' },
        { label: '复数（名词）', value: 'firms' },
      ],
    },
    flat: {
      meanings: ['n. 公寓；adj. 平的；扁平的'],
      forms: [
        { label: '比较级', value: 'flatter' },
        { label: '最高级', value: 'flattest' },
        { label: '复数（名词）', value: 'flats' },
      ],
    },
    fly: {
      meanings: ['v. 飞；空运；放飞；n. 苍蝇；飞行'],
      forms: [
        { label: '过去式', value: 'flew' },
        { label: '过去分词', value: 'flown' },
        { label: '现在分词', value: 'flying' },
        { label: '第三人称单数 / 复数', value: 'flies' },
      ],
    },
    kind: {
      meanings: ['n. 种类；adj. 仁慈的；友好的'],
      forms: [
        { label: '比较级', value: 'kinder' },
        { label: '最高级', value: 'kindest' },
        { label: '复数（名词）', value: 'kinds' },
      ],
    },
    make: {
      meanings: ['v. 制造；使得；成为；n. 样式；品牌'],
      forms: [
        { label: '过去式 / 过去分词', value: 'made' },
        { label: '现在分词', value: 'making' },
        { label: '第三人称单数', value: 'makes' },
      ],
    },
    mine: {
      meanings: ['pron. 我的；n. 矿；地雷；v. 开采'],
      forms: [
        { label: '过去式 / 过去分词', value: 'mined' },
        { label: '现在分词', value: 'mining' },
        { label: '第三人称单数 / 复数', value: 'mines' },
      ],
    },
    park: {
      meanings: ['n. 公园；v. 停放'],
      forms: [
        { label: '过去式 / 过去分词', value: 'parked' },
        { label: '现在分词', value: 'parking' },
        { label: '第三人称单数 / 复数', value: 'parks' },
      ],
    },
    patient: {
      meanings: ['n. 病人；adj. 耐心的；能忍耐的'],
      forms: [{ label: '复数（名词）', value: 'patients' }],
    },
    present: {
      meanings: ['n. 礼物；现在；v. 赠送；呈现；adj. 在场的；现在的'],
      forms: [
        { label: '过去式 / 过去分词', value: 'presented' },
        { label: '现在分词', value: 'presenting' },
        { label: '第三人称单数 / 复数', value: 'presents' },
      ],
    },
    record: {
      meanings: ['n. 记录；纪录；唱片；v. 记录；录制'],
      forms: [
        { label: '过去式 / 过去分词', value: 'recorded' },
        { label: '现在分词', value: 'recording' },
        { label: '第三人称单数 / 复数', value: 'records' },
      ],
    },
    set: {
      meanings: ['n. 一套；一组；设备；v. 放置；设置；安排；adj. 固定的'],
      forms: [
        { label: '过去式 / 过去分词', value: 'set' },
        { label: '现在分词', value: 'setting' },
        { label: '第三人称单数 / 复数', value: 'sets' },
      ],
    },
    shine: {
      meanings: ['n. 光泽；光彩；v. 照耀；发光'],
      forms: [
        { label: '过去式 / 过去分词', value: 'shone' },
        { label: '现在分词', value: 'shining' },
        { label: '第三人称单数 / 复数', value: 'shines' },
      ],
    },
    swim: {
      meanings: ['n. 游泳；v. 游泳'],
      forms: [
        { label: '过去式', value: 'swam' },
        { label: '过去分词', value: 'swum' },
        { label: '现在分词', value: 'swimming' },
        { label: '第三人称单数 / 复数', value: 'swims' },
      ],
    },
    well: {
      meanings: ['n. 井；adv. 好；充分地；adj. 健康的；int. 好吧'],
      forms: [
        { label: '比较级', value: 'better' },
        { label: '最高级', value: 'best' },
        { label: '复数（名词）', value: 'wells' },
      ],
    },
    bear: {
      meanings: ['v. 承受；忍受；负担；生育', 'n. 熊'],
      forms: [
        { label: '过去式', value: 'bore' },
        { label: '过去分词', value: 'borne / born' },
        { label: '现在分词', value: 'bearing' },
        { label: '第三人称单数 / 复数', value: 'bears' },
      ],
    },
    lie: {
      meanings: ['n. 谎言；v. 说谎', 'v. 躺；卧；位于；在于'],
      forms: [
        { label: '过去式（说谎）', value: 'lied' },
        { label: '过去分词（说谎）', value: 'lied' },
        { label: '过去式（躺）', value: 'lay' },
        { label: '过去分词（躺）', value: 'lain' },
        { label: '现在分词', value: 'lying' },
        { label: '第三人称单数', value: 'lies' },
      ],
    },
    wind: {
      meanings: ['n. 风；气息；呼吸', 'v. 缠绕；蜿蜒；给……上发条'],
      forms: [
        { label: '复数', value: 'winds' },
        { label: '过去式 / 过去分词（缠绕）', value: 'wound' },
        { label: '现在分词', value: 'winding' },
        { label: '第三人称单数', value: 'winds' },
      ],
    },
  },

  // Meanings for roots that are useful on a member card but are not themselves
  // drawable entries in the 3423-record source list.
  rootMeanings: {
    addict: 'v. 使上瘾；使沉迷',
    compose: 'v. 组成；创作；作曲',
    identify: 'v. 识别；确认',
    locate: 'v. 找出……的位置；使坐落于',
    motivate: 'v. 激励；成为……的动机',
    organize: 'v. 组织；安排',
    qualify: 'v. 取得资格；使合格',
    revise: 'v. 复习；修订',
    sign: 'n. 标志；迹象；v. 签署',
    vary: 'v. 变化；相异',
    detect: 'v. 发现；察觉；探测',
  },

  familyAdditions: {
    abolish: {
      members: [
        ['abolition', 'n. 废除；废止'],
        ['abolitionist', 'n. 废除主义者'],
      ],
    },
    ambition: {
      members: [
        ['ambitious', 'adj. 有雄心的；有抱负的'],
        ['ambitiously', 'adv. 雄心勃勃地'],
      ],
    },
    detect: {
      members: [
        ['detection', 'n. 发现；侦查；探测'],
        ['detective', 'n. 侦探；adj. 侦探的'],
        ['detector', 'n. 探测器；检测器'],
        ['detectable', 'adj. 可察觉的；可检测的'],
      ],
    },
    acquire: {
      members: [
        ['acquisition', 'n. 获得；习得；购置物'],
        ['acquired', 'adj. 后天获得的；习得的'],
      ],
    },
    consequence: {
      members: [
        ['consequent', 'adj. 随之发生的；作为结果的'],
        ['consequently', 'adv. 因此；所以'],
      ],
    },
    distinguish: {
      members: [
        ['distinction', 'n. 区别；差别；卓越'],
        ['distinct', 'adj. 明显不同的；清楚的'],
        ['distinctive', 'adj. 独特的；有特色的'],
        ['distinguished', 'adj. 卓越的；著名的'],
      ],
    },
    persuade: {
      members: [
        ['persuasion', 'n. 说服；劝说'],
        ['persuasive', 'adj. 有说服力的'],
        ['persuasively', 'adv. 有说服力地'],
      ],
    },
    acknowledge: {
      members: [
        ['acknowledgement', 'n. 承认；感谢；确认'],
        ['acknowledged', 'adj. 公认的'],
      ],
    },
    transform: {
      members: [
        ['transformation', 'n. 转变；改造'],
        ['transformative', 'adj. 具有变革作用的'],
      ],
    },
    anticipate: {
      members: [
        ['anticipation', 'n. 预期；期待'],
        ['anticipated', 'adj. 预期的'],
      ],
    },
    capacity: {
      members: [
        ['capable', 'adj. 有能力的；能胜任的'],
        ['capability', 'n. 能力；潜能'],
      ],
    },
    cite: {
      members: [['citation', 'n. 引用；引文']],
    },
    collapse: {
      members: [
        ['collapsed', 'adj. 倒塌的；崩溃的'],
        ['collapsible', 'adj. 可折叠的'],
      ],
    },
    context: {
      members: [['contextual', 'adj. 与语境有关的']],
    },
    contrast: {
      members: [
        ['contrasting', 'adj. 形成鲜明对比的'],
        ['contrastive', 'adj. 对比的'],
      ],
    },
    cooperate: {
      members: [
        ['cooperation', 'n. 合作；协作'],
        ['cooperative', 'adj. 合作的；配合的'],
      ],
    },
    coordinate: {
      members: [
        ['coordination', 'n. 协调；配合'],
        ['coordinator', 'n. 协调者；统筹者'],
      ],
    },
    define: {
      members: [
        ['definition', 'n. 定义；界定'],
        ['definite', 'adj. 明确的；肯定的'],
        ['definitely', 'adv. 确切地；肯定地'],
      ],
    },
    demonstrate: {
      members: [
        ['demonstration', 'n. 证明；示范；演示'],
        ['demonstrative', 'adj. 说明的；感情外露的'],
      ],
    },
    deny: {
      members: [['denial', 'n. 否认；拒绝']],
    },
    depression: {
      members: [
        ['depress', 'v. 使沮丧；使萧条'],
        ['depressed', 'adj. 沮丧的；萧条的'],
        ['depressive', 'adj. 抑郁的；令人消沉的'],
      ],
    },
    derive: {
      members: [
        ['derivation', 'n. 起源；派生；推导'],
        ['derivative', 'adj. 派生的；n. 派生物'],
      ],
    },
    discipline: {
      members: [
        ['disciplined', 'adj. 遵守纪律的；训练有素的'],
        ['disciplinary', 'adj. 纪律的；学科的'],
      ],
    },
    discriminate: {
      members: [
        ['discrimination', 'n. 区分；歧视'],
        ['discriminatory', 'adj. 歧视性的'],
      ],
    },
    dominate: {
      members: [
        ['dominant', 'adj. 占主导地位的'],
        ['dominance', 'n. 支配；优势'],
      ],
    },
    economy: {
      members: [
        ['economic', 'adj. 经济的；经济学的'],
        ['economical', 'adj. 节约的；经济实惠的'],
        ['economist', 'n. 经济学家'],
      ],
    },
    efficient: {
      members: [
        ['efficiency', 'n. 效率；效能'],
        ['efficiently', 'adv. 高效地'],
        ['inefficient', 'adj. 效率低的'],
      ],
    },
    eliminate: {
      members: [['elimination', 'n. 消除；淘汰']],
    },
    emerge: {
      members: [
        ['emergence', 'n. 出现；兴起'],
        ['emerging', 'adj. 新兴的；正在出现的'],
      ],
    },
    emphasize: {
      members: [
        ['emphasis', 'n. 强调；重点'],
        ['emphatic', 'adj. 强调的；坚决的'],
      ],
    },
    engage: {
      members: [
        ['engagement', 'n. 参与；约定；订婚'],
        ['engaged', 'adj. 忙于；已订婚的'],
      ],
    },
    enhance: {
      members: [['enhancement', 'n. 提高；增强']],
    },
    equivalent: {
      members: [['equivalence', 'n. 等同；等值']],
    },
    establish: {
      members: [
        ['establishment', 'n. 建立；机构'],
        ['established', 'adj. 已确立的；知名的'],
      ],
    },
    estimate: {
      members: [
        ['estimation', 'n. 估计；判断'],
        ['underestimate', 'v. 低估'],
        ['overestimate', 'v. 高估'],
      ],
    },
    evolve: {
      members: [
        ['evolution', 'n. 进化；演变'],
        ['evolutionary', 'adj. 进化的；演变的'],
      ],
    },
    exceed: {
      members: [
        ['excess', 'n. 超额；过量'],
        ['excessive', 'adj. 过度的；过量的'],
        ['excessively', 'adv. 过度地'],
      ],
    },
    exclude: {
      members: [
        ['exclusion', 'n. 排除；排斥'],
        ['exclusive', 'adj. 独有的；排他的'],
        ['exclusively', 'adv. 专门地；仅仅'],
      ],
    },
    exhibit: {
      members: [
        ['exhibition', 'n. 展览；展出'],
        ['exhibitor', 'n. 参展者；展出者'],
      ],
    },
    generate: {
      members: [
        ['generation', 'n. 产生；一代人'],
        ['generator', 'n. 发电机；生成器'],
        ['generative', 'adj. 有生成能力的'],
      ],
    },
    hypothesis: {
      members: [
        ['hypothetical', 'adj. 假设的；假定的'],
        ['hypothetically', 'adv. 假设地'],
      ],
    },
    illustrate: {
      members: [
        ['illustration', 'n. 说明；插图；例证'],
        ['illustrative', 'adj. 说明性的；示例性的'],
      ],
    },
    imply: {
      members: [
        ['implication', 'n. 含义；暗示；可能的影响'],
        ['implicit', 'adj. 含蓄的；隐含的'],
        ['implicitly', 'adv. 含蓄地；隐含地'],
      ],
    },
    impose: {
      members: [['imposition', 'n. 强加；征收']],
    },
    inevitable: {
      members: [['inevitably', 'adv. 不可避免地']],
    },
    infer: {
      members: [
        ['inference', 'n. 推断；推论'],
        ['inferential', 'adj. 推论的；推理的'],
      ],
    },
    invent: {
      members: [
        ['innovate', 'v. 创新；革新'],
        ['innovation', 'n. 创新；革新'],
        ['innovator', 'n. 创新者'],
      ],
    },
    integrate: {
      members: [
        ['integration', 'n. 融合；一体化'],
        ['integrated', 'adj. 综合的；一体化的'],
      ],
    },
    interact: {
      members: [
        ['interaction', 'n. 互动；相互作用'],
        ['interactive', 'adj. 互动的；交互式的'],
      ],
    },
    interpret: {
      members: [
        ['interpretation', 'n. 解释；理解；口译'],
        ['interpreter', 'n. 口译员；解释程序'],
      ],
    },
    invest: {
      members: [
        ['investment', 'n. 投资；投入'],
        ['investor', 'n. 投资者'],
      ],
    },
    involve: {
      members: [
        ['involvement', 'n. 参与；牵涉'],
        ['involved', 'adj. 有关的；复杂的'],
      ],
    },
    justify: {
      members: [
        ['justification', 'n. 正当理由；辩护'],
        ['justified', 'adj. 有正当理由的'],
      ],
    },
    maintain: {
      members: [['maintenance', 'n. 维护；保养；维持']],
    },
    manipulate: {
      members: [
        ['manipulation', 'n. 操纵；处理；篡改'],
        ['manipulative', 'adj. 操纵性的；善于操控的'],
      ],
    },
    modify: {
      members: [
        ['modification', 'n. 修改；调整'],
        ['modifier', 'n. 修饰语；修改者'],
      ],
    },
    objective: {
      members: [
        ['objectively', 'adv. 客观地'],
        ['objectivity', 'n. 客观性'],
      ],
    },
    perceive: {
      members: [
        ['perception', 'n. 感知；看法'],
        ['perceptive', 'adj. 感知敏锐的；有洞察力的'],
      ],
    },
    propose: {
      members: [
        ['proposal', 'n. 提议；建议；求婚'],
        ['proposition', 'n. 主张；提议；命题'],
      ],
    },
    psychology: {
      members: [
        ['psychological', 'adj. 心理的；心理学的'],
        ['psychologist', 'n. 心理学家'],
        ['psychologically', 'adv. 心理上地'],
      ],
    },
    regulate: {
      members: [
        ['regulation', 'n. 管理；规章；调节'],
        ['regulatory', 'adj. 监管的；调节的'],
        ['regulator', 'n. 监管者；调节器'],
      ],
    },
    relevant: {
      members: [
        ['relevance', 'n. 相关性'],
        ['irrelevant', 'adj. 不相关的；离题的'],
      ],
    },
    relieve: {
      members: [['relief', 'n. 减轻；缓解；救济']],
    },
    resolve: {
      members: [
        ['resolution', 'n. 解决；决心；决议'],
        ['resolute', 'adj. 坚决的；坚定的'],
      ],
    },
    restrict: {
      members: [
        ['restriction', 'n. 限制；约束'],
        ['restrictive', 'adj. 限制性的'],
      ],
    },
    retain: {
      members: [['retention', 'n. 保留；保持；记忆力']],
    },
    reveal: {
      members: [['revelation', 'n. 揭示；被揭露的真相']],
    },
    strategy: {
      members: [
        ['strategic', 'adj. 战略的；策略性的'],
        ['strategically', 'adv. 战略上；有策略地'],
        ['strategist', 'n. 战略家；善于谋划者'],
      ],
    },
    structure: {
      members: [
        ['structural', 'adj. 结构的；构造的'],
        ['restructure', 'v. 重组；调整结构'],
      ],
    },
    sufficient: {
      members: [
        ['sufficiently', 'adv. 足够地；充分地'],
        ['insufficient', 'adj. 不足的；不充分的'],
      ],
    },
    summarize: {
      members: [['summary', 'n. 总结；概要']],
    },
    transmit: {
      members: [
        ['transmission', 'n. 传输；传播；传染'],
        ['transmitter', 'n. 发射机；传播者'],
      ],
    },
    virtual: {
      members: [['virtually', 'adv. 几乎；实际上；虚拟地']],
    },
  },

  // Phrases are owned by the displayed headword. This prevents a family member
  // from inheriting an unrelated phrase merely because it shares a root.
  phraseAssignments: {
    abolish: ['abolish a system 废除一种制度'],
    ambition: [
      'have an ambition to do sth 有做某事的抱负',
      'achieve one\'s ambition 实现某人的抱负',
    ],
    detective: ['a private detective 私人侦探'],
    acquire: [
      'acquire knowledge 获取知识',
      'acquire a skill 掌握一项技能',
    ],
    consequence: [
      'as a consequence 因此；结果',
      'face the consequences 承担后果',
    ],
    distinguish: ['distinguish A from B 区分 A 与 B'],
    persuade: ['persuade sb to do sth 说服某人做某事'],
    acknowledge: ['acknowledge the importance of 承认……的重要性'],
    transform: ['transform ... into ... 把……转变成……'],
    anticipate: ['anticipate doing sth 预料会做某事'],
    capacity: ['have the capacity to do sth 有能力做某事'],
    cease: ['cease to do / doing sth 停止做某事'],
    cite: ['cite ... as evidence 引用……作为证据'],
    collapse: ['economic collapse 经济崩溃'],
    context: ['in the context of 在……背景下'],
    contract: ['sign a contract 签订合同'],
    contrast: ['in contrast to 与……形成对比'],
    cooperate: ['cooperate with sb 与某人合作'],
    coordinate: ['coordinate with 与……协调'],
    core: ['at the core of 位于……的核心'],
    crucial: ['be crucial to 对……至关重要'],
    define: ['be defined as 被定义为'],
    demonstrate: ['demonstrate the ability to 展示……的能力'],
    deny: ['deny doing sth 否认做过某事'],
    depression: ['fall into depression 陷入抑郁或消沉'],
    derive: ['derive from 源自；来自'],
    deserve: ['deserve to be done 值得被……'],
    detect: ['detect a change 察觉变化'],
    discipline: ['self-discipline 自律'],
    discriminate: ['discriminate between A and B 区分 A 与 B'],
    domestic: ['domestic demand 国内需求'],
    dominate: ['dominate the market 占据市场主导地位'],
    economy: ['market economy 市场经济'],
    efficient: ['energy-efficient 节能高效的'],
    eliminate: ['eliminate the possibility of 排除……的可能性'],
    emerge: ['emerge from 从……中出现；摆脱'],
    emphasize: ['emphasize the importance of 强调……的重要性'],
    encounter: ['encounter difficulties 遇到困难'],
    engage: ['engage in 参加；从事'],
    enhance: ['enhance awareness 提高意识'],
    ensure: ['ensure that ... 确保……'],
    equivalent: ['be equivalent to 等同于'],
    establish: ['establish a relationship 建立关系'],
    estimate: ['be estimated to 据估计……'],
    evolve: ['evolve into 逐渐发展成'],
    exceed: ['exceed expectations 超出预期'],
    exclude: ['exclude ... from ... 将……排除在……之外'],
    exhibit: ['exhibit symptoms 表现出症状'],
    extend: ['extend to 延伸到；扩大到'],
    external: ['external factors 外部因素'],
    factor: ['a key factor in ……的关键因素'],
    foundation: ['lay the foundation for 为……奠定基础'],
    generate: ['generate interest 激发兴趣'],
    highlight: ['highlight the importance of 突出……的重要性'],
    hypothesis: ['test a hypothesis 检验假设'],
    identify: ['identify ... as ... 认定……为……'],
    illustrate: ['illustrate ... with examples 用例子说明……'],
    imply: ['imply that ... 暗示……'],
    impose: ['impose restrictions on 对……施加限制'],
    incentive: ['an incentive to do sth 做某事的动力'],
    inevitable: ['an inevitable consequence 必然结果'],
    infer: ['infer ... from ... 从……推断出……'],
    innovate: ['innovate in 在……方面创新'],
    instance: ['for instance 例如'],
    integrate: ['integrate ... into ... 把……融入……'],
    interact: ['interact with 与……互动'],
    interpret: ['interpret ... as ... 把……理解为……'],
    invest: ['invest in 投资于；投入'],
    involve: ['involve doing sth 涉及做某事'],
    issue: ['address an issue 处理问题'],
    justify: ['justify doing sth 证明做某事有正当理由'],
    launch: ['launch a campaign 发起活动'],
    maintain: ['maintain a balance 保持平衡'],
    manipulate: ['manipulate data 操纵或篡改数据'],
    mechanism: ['underlying mechanism 内在机制'],
    modify: ['modify ... to suit ... 修改……以适应……'],
    objective: ['achieve an objective 实现目标'],
    organize: ['organize an event 组织活动'],
    perceive: ['perceive ... as ... 将……视为……'],
    perspective: ['from the perspective of 从……的角度看'],
    priority: ['give priority to 优先考虑'],
    proceed: ['proceed with 继续进行'],
    propose: ['propose doing sth 建议做某事'],
    prospect: ['the prospect of ……的前景或可能性'],
    psychological: ['psychological well-being 心理健康'],
    pursue: ['pursue a goal 追求目标'],
    regulate: ['regulate the market 监管市场'],
    relevant: ['be relevant to 与……有关'],
    relieve: ['relieve pressure 缓解压力'],
    resolve: ['resolve a conflict 解决冲突'],
    restrict: ['restrict access to 限制对……的访问'],
    retain: ['retain information 记住所学信息'],
    reveal: ['reveal the truth 揭示真相'],
    significant: ['play a significant role in 在……中发挥重要作用'],
    source: ['a source of ……的来源'],
    strategy: ['adopt a strategy 采取策略'],
    structure: ['sentence structure 句子结构'],
    sufficient: ['be sufficient to 足以……'],
    summarize: ['summarize an argument 概括论点'],
    transmit: ['transmit data 传输数据'],
    vary: ['vary from ... to ... 从……到……不等'],
    virtual: ['virtual reality 虚拟现实'],
    construct: ['construct a model 构建模型'],
    construction: ['under construction 在建设中'],
    evaluate: ['evaluate the effect of 评估……的影响'],
    recognise: ['be recognised as 被认为是；被公认为'],
    responsibility: ['take responsibility for 对……负责'],
    interest: ['show an interest in 对……表现出兴趣'],
    interesting: ['find ... interesting 觉得……有趣'],
    organization: ['an international organization 一个国际组织'],
    variety: ['a variety of 各种各样的'],
    various: ['various kinds of 各种各样的'],

    care: ['care about 关心；在乎', 'take care of 照顾'],
    careful: ['be careful with 小心对待'],
    develop: [
      'develop a habit of doing sth 培养做某事的习惯',
      'develop into 发展成',
    ],
    development: ['with the development of 随着……的发展'],
    devote: [
      'devote ... to ... 把……投入到……',
      'be devoted to doing sth 致力于做某事',
    ],
    environment: [
      'protect the environment 保护环境',
      'environmentally friendly 环保的',
    ],
    protect: ['protect ... from/against ... 保护……免受……'],
    protection: ['under the protection of 在……的保护下'],
    success: ['achieve success 取得成功'],
    succeed: ['succeed in doing sth 成功做某事'],
    successful: ['be successful in doing sth 在做某事上成功'],
  },
};
