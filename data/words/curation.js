'use strict';

/*
 * Human-reviewed corrections and additions.
 *
 * This is the authoritative place for semantic decisions that cannot be made
 * safely from spelling alone. The runtime file in app/js is generated; do not
 * put hand-written corrections there.
 */

module.exports = {
  version: '2026.09.01',

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
