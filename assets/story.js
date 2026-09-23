// Overview scrollytelling per dynasty. `poets` are names in the data; colours come from the palette in app.js.
window.STORY = {
  tang: {
    intro: {
      zh: (n, s) => `<p class="kicker">唐 · 618—907</p><h2>${n} 位诗人，${s} 处行迹</h2><p class="lead">每一条细线，是一个唐朝人一辈子走过的路。</p><p>叠在一起，就是这团乱麻：长安、洛阳、扬州、成都，几乎每个人都要经过。往下滑，一个一个看。</p>`,
      en: (n, s) => `<p class="kicker">Tang · 618–907</p><h2>${n} poets, ${s} stops</h2><p class="lead">Each faint line is one Tang poet’s whole life on the road.</p><p>Stacked together they make this tangle. Chang’an, Luoyang, Yangzhou, Chengdu: almost everyone passed through. Scroll, one at a time.</p>`,
    },
    steps: [
      { poets: ["李白"],
        zh: `<p class="kicker">盛唐</p><h3>李白：一辈子在路上</h3><p>二十四五岁出蜀，“仗剑去国，辞亲远游”，从此三十多年没有真正停下来。安陆、东鲁、长安、金陵、宣城，最后停在当涂。</p><p>红线就是他。这张图上，没有第二个人走得比他更远。</p>`,
        en: `<p class="kicker">High Tang</p><h3>Li Bai never stopped moving</h3><p>He left Sichuan in his mid-twenties, sword at his side, and for more than thirty years kept going: Anlu, Shandong, Chang’an, Jinling, Xuancheng, and finally Dangtu.</p><p>The red line is his. Nobody on this map covers more ground.</p>` },
      { poets: ["杜甫", "李白"],
        zh: `<p class="kicker">盛唐</p><h3>杜甫：和李白只交汇了一小段</h3><p>744 年，两人在洛阳初识，又同游梁宋；次年在东鲁分手，此后再没见过。</p><p>蓝线是杜甫。安史之乱后，他一路向西、入蜀，晚年沿长江出峡，死在湘江的船上。</p>`,
        en: `<p class="kicker">High Tang</p><h3>Du Fu crossed Li Bai’s path only briefly</h3><p>They met in Luoyang in 744 and travelled together through Liang and Song. They parted in Shandong the next year and never met again.</p><p>Du Fu is the blue line. After the An Lushan rebellion he went west into Sichuan, then down the Yangtze, and died on a boat on the Xiang River.</p>` },
      { poets: ["王维"],
        zh: `<p class="kicker">盛唐</p><h3>王维：隐士也要出差</h3><p>人们记得他在辋川隐居，可绿线伸向四个方向：721 年贬济州，737 年出塞凉州（“大漠孤烟直”就写在那条路上），740 年南下桂林主持选官，745 年又北使榆林。</p>`,
        en: `<p class="kicker">High Tang</p><h3>Wang Wei, the recluse who kept being sent away</h3><p>He is remembered at his Wangchuan retreat, but the green line reaches in four directions: exile to Jizhou in 721, the frontier at Liangzhou in 737 (“a lone plume of smoke rises straight over the desert”), Guilin in 740 to run the southern selections, and Yulin in the north in 745.</p>` },
      { poets: ["白居易"],
        zh: `<p class="kicker">中唐</p><h3>白居易：贬谪也走成了一条风景线</h3><p>815 年贬江州司马，写下《琵琶行》；后来做杭州、苏州刺史，修堤、写西湖。晚年定居洛阳履道里，活到七十五岁。</p>`,
        en: `<p class="kicker">Mid Tang</p><h3>Bai Juyi turned exile into scenery</h3><p>Demoted to Jiangzhou in 815, where he wrote the Song of the Pipa, he later governed Hangzhou and Suzhou, building dikes and writing about West Lake. He retired to Luoyang and lived to 75.</p>` },
      { poets: ["韩愈", "柳宗元"],
        zh: `<p class="kicker">中唐</p><h3>韩愈、柳宗元：往南，是贬谪的方向</h3><p>柳宗元 805 年贬永州，十年后再贬柳州，死在那里。韩愈 819 年因谏迎佛骨贬潮州，“一封朝奏九重天，夕贬潮州路八千”。</p><p>两条线都拉向岭南。唐朝人被贬，往往就是往南走。</p>`,
        en: `<p class="kicker">Mid Tang</p><h3>Han Yu and Liu Zongyuan: south meant exile</h3><p>Liu was banished to Yongzhou in 805, then further to Liuzhou, where he died. Han Yu protested the emperor’s Buddha-relic procession in 819 and was sent to Chaozhou, “eight thousand li” away.</p><p>Both lines pull toward the far south. For a Tang official, that was the direction of punishment.</p>` },
      { poets: ["李商隐", "杜牧"],
        zh: `<p class="kicker">晚唐</p><h3>李商隐、杜牧：在幕府之间辗转</h3><p>晚唐的读书人，大多靠给节度使做幕僚谋生。李商隐从郑州、洛阳一路到桂林、梓州；杜牧在扬州、宣州、黄州、池州之间来回。</p>`,
        en: `<p class="kicker">Late Tang</p><h3>Li Shangyin and Du Mu drifted between patrons</h3><p>Late Tang literati often lived as secretaries to regional governors. Li Shangyin went from Zhengzhou and Luoyang as far as Guilin and Zizhou; Du Mu shuttled between Yangzhou, Xuanzhou, Huangzhou and Chizhou.</p>` },
    ],
    outro: {
      zh: `<p class="kicker">轮到你</p><h3>选一位诗人，跟他走一遍</h3><p>在上方输入名字，或者直接点：</p>`,
      en: `<p class="kicker">Your turn</p><h3>Pick a poet and follow the road</h3><p>Type a name above, or start with one of these:</p>`,
      picks: ["李白", "杜甫", "王维", "白居易", "韩愈", "柳宗元", "刘禹锡", "李商隐", "杜牧", "王昌龄"],
    },
  },
  wudai: {
    intro: {
      zh: (n, s) => `<p class="kicker">五代十国 · 907—979</p><h2>${n} 位诗人，${s} 处行迹</h2><p class="lead">唐亡之后，北方五个朝代走马灯般更替，南方分成十个小国。</p><p>这份数据里的五代诗人不多，大多在南唐和前蜀。往下滑，看南唐的两位国主。</p>`,
      en: (n, s) => `<p class="kicker">Five Dynasties · 907–979</p><h2>${n} poets, ${s} stops</h2><p class="lead">After the Tang fell, five short dynasties followed each other in the north while the south split into ten kingdoms.</p><p>Few Five Dynasties poets are in this dataset, mostly from Southern Tang and Former Shu. Scroll for the two Southern Tang rulers.</p>`,
    },
    steps: [
      { poets: ["李煜", "李璟"],
        zh: `<p class="kicker">南唐</p><h3>李璟、李煜：从金陵到汴京</h3><p>父子两代南唐国主都以词名世。975 年宋军攻破金陵，李煜被押往汴京，“故国不堪回首月明中”，三年后死在那里。</p>`,
        en: `<p class="kicker">Southern Tang</p><h3>Li Jing and Li Yu: from Jinling to Kaifeng</h3><p>Father and son, both rulers of Southern Tang, are remembered for their lyrics. When Song armies took Jinling in 975, Li Yu was taken captive to Kaifeng (“I cannot bear to look back at my lost land in the moonlight”) and died there three years later.</p>` },
    ],
    outro: {
      zh: `<p class="kicker">轮到你</p><h3>选一位诗人，跟他走一遍</h3>`,
      en: `<p class="kicker">Your turn</p><h3>Pick a poet and follow the road</h3>`,
      picks: ["李煜", "李璟", "冯延巳", "贯休"],
    },
  },
  song: {
    intro: {
      zh: (n, s) => `<p class="kicker">宋 · 960—1279</p><h2>${n} 位诗人，${s} 处行迹</h2><p class="lead">宋朝的线，比唐朝更往东南挤。</p><p>1127 年以后，北方丢了，汴京换成临安，路也跟着南移。往下滑，看几个人。</p>`,
      en: (n, s) => `<p class="kicker">Song · 960–1279</p><h2>${n} poets, ${s} stops</h2><p class="lead">Song lines crowd further to the southeast than Tang ones.</p><p>After 1127 the north was lost, Kaifeng gave way to Hangzhou, and the roads moved south with it. Scroll for a few of them.</p>`,
    },
    steps: [
      { poets: ["苏轼"],
        zh: `<p class="kicker">北宋</p><h3>苏轼：“问汝平生功业，黄州惠州儋州”</h3><p>从眉山出发，做过杭州、密州、徐州、湖州的地方官；乌台诗案后贬黄州，晚年一贬再贬，惠州、儋州，渡海到了海南。遇赦北归，死在常州。</p>`,
        en: `<p class="kicker">Northern Song</p><h3>Su Shi: “My life’s work? Huangzhou, Huizhou, Danzhou.”</h3><p>From Meishan he served in Hangzhou, Mizhou, Xuzhou and Huzhou, was exiled to Huangzhou after the Crow Terrace case, and in old age was pushed further and further south, to Huizhou and across the sea to Hainan. Pardoned, he died on the way home, at Changzhou.</p>` },
      { poets: ["李清照"],
        zh: `<p class="kicker">两宋之际</p><h3>李清照：前半生在北方，后半生在逃</h3><p>济南出生，汴京成婚，青州屏居十年。1127 年金兵南下，她带着金石书画一路南渡：建康、越州、台州、温州，最后落脚临安。</p>`,
        en: `<p class="kicker">Northern to Southern Song</p><h3>Li Qingzhao: half a life in the north, half on the run</h3><p>Born in Jinan, married in Kaifeng, ten quiet years in Qingzhou. When the Jin armies came in 1127 she fled south with the couple’s collection of bronzes and books: Jiankang, Yuezhou, Taizhou, Wenzhou, and at last Lin’an.</p>` },
      { poets: ["陆游"],
        zh: `<p class="kicker">南宋</p><h3>陆游：一辈子想往北，只走到了南郑</h3><p>1172 年他在南郑前线待了大半年，那是他离中原最近的时候。之后入蜀多年，晚年回到山阴老家，“王师北定中原日，家祭无忘告乃翁”。</p>`,
        en: `<p class="kicker">Southern Song</p><h3>Lu You wanted the north all his life, and got as far as Nanzheng</h3><p>In 1172 he spent most of a year on the Nanzheng front, the closest he ever came to the lost heartland. Years in Sichuan followed, then home to Shanyin, still asking his sons to tell him when the north was retaken.</p>` },
      { poets: ["辛弃疾"],
        zh: `<p class="kicker">南宋</p><h3>辛弃疾：从金国境内南归</h3><p>他生在金人统治下的济南，1162 年带着起义军南归。此后在江西、湖南、福建、浙东做官，又两度闲居上饶、铅山，再没能回到北方。</p>`,
        en: `<p class="kicker">Southern Song</p><h3>Xin Qiji came south out of Jin territory</h3><p>Born in Jinan under Jin rule, he crossed to the Song in 1162 with a rebel band. He served in Jiangxi, Hunan, Fujian and Zhejiang, retired twice to Shangrao and Yanshan, and never saw the north again.</p>` },
      { poets: ["欧阳修", "王安石"],
        zh: `<p class="kicker">北宋</p><h3>欧阳修、王安石：汴京，是所有线的中心</h3><p>北宋的路都通向开封。欧阳修贬过夷陵、滁州，王安石从江宁起家、两度拜相、又回到江宁。两条线在汴京和江南之间来回交叉。</p>`,
        en: `<p class="kicker">Northern Song</p><h3>Ouyang Xiu and Wang Anshi: every road ran through Kaifeng</h3><p>Ouyang Xiu was exiled to Yiling and Chuzhou; Wang Anshi rose from Jiangning, twice became chief minister, and went back to Jiangning. Their lines cross back and forth between the capital and the Yangtze delta.</p>` },
    ],
    outro: {
      zh: `<p class="kicker">轮到你</p><h3>选一位诗人，跟他走一遍</h3><p>在上方输入名字，或者直接点：</p>`,
      en: `<p class="kicker">Your turn</p><h3>Pick a poet and follow the road</h3><p>Type a name above, or start with one of these:</p>`,
      picks: ["苏轼", "李清照", "陆游", "辛弃疾", "欧阳修", "王安石"],
    },
  },
};
