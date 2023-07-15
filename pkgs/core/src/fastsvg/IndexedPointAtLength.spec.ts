import pal from 'point-at-length'
import { indexedPointAtLength } from './IndexedPointAtLength'

describe('IndexedPointAtLength', () => {
  const path = complexPath()

  it('indexing time', () => {
    const buildTime = time(() => {
      indexedPointAtLength(path)
    })

    console.info(`Indexing time: ${buildTime}ms`)
  })

  it('should be returns same result to point-at-length', () => {
    const original = pal(path)
    const cached = indexedPointAtLength(path)
    const length = cached.totalLength

    for (let i = 0; i < length; i += length / 500) {
      expect(cached.at(i)[0]).toBeCloseTo(original.at(i)[0], 2)
      expect(cached.at(i)[1]).toBeCloseTo(original.at(i)[1], 2)
    }
  })

  describe('getSequencialReader', () => {
    it('should returns same result to .at()', () => {
      // const cached = indexedPointAtLength(simplePath())
      const cached = indexedPointAtLength(complexPath())
      const reader = cached.getSequencialReader()

      expect(reader.at(0)).toEqual(cached.at(0))
      expect(reader.at(50)).toEqual(cached.at(50))
      expect(reader.at(100)).toEqual(cached.at(100))
    })

    it('should hits cache', () => {
      const cached = indexedPointAtLength(path)
      const reader = cached.getSequencialReader()
    })

    it('check using hint', () => {
      const times = 1000

      const normal = indexedPointAtLength(path)
      const cached = normal.getSequencialReader()

      const normalTime = time(() => {
        for (let i = 0; i < times; i++) {
          normal.at(normal.totalLength * (i / times))
        }
      })

      const cachedTime = time(() => {
        for (let i = 0; i < times; i++) {
          cached.at(normal.totalLength * (i / times))
        }
      })

      console.log(`normal ${times}times:`, normalTime)
      console.log(`cached ${times}times:`, cachedTime)
      console.log('faster:', normalTime - cachedTime)
    })
  })

  describe('line', () => {
    it('Should not return NaN', () => {
      const line = 'M0,0 C 50,50 50,50 50,50 L100,100'
      const cached = indexedPointAtLength(line)

      expect(cached.totalLength).not.toBeNaN()

      const pt = cached.at(0.5)
      expect(pt[0]).not.toBeNaN()
      expect(pt[1]).not.toBeNaN()
    })
  })
})

function time(fn: () => void) {
  const start = performance.now()
  fn()
  return performance.now() - start
}

function complexPath() {
  return `
  M38.169,96.8065
  C 38.169,131.5498 35.6639,167.19459999999998 39.500499999999995 201.72050000000002
  C 42.371599999999994,227.5576 50.2825,252.3829 53.046699999999994 278.2597
  C 60.70309999999999,349.9344 67.42559999999999,422.4005 81.115 493.2152
  C 87.8256,527.9289 95.69959999999999,562.6148 103.3399 597.1406
  C 105.9211,608.8045999999999 109.9996,620.1493999999999 111.699 632.0055
  C 113.6246,645.4399 112.7864,658.9071 113.1875 672.404
  C 114.404,713.3492 113.687,754.3305 114.7853 795.2913
  C 116.0122,841.0486999999999 140.1821,911.2361999999999 158.00830000000002 954.6943
  C 165.77820000000003,973.6363 177.64770000000001,995.851 198.41340000000002 1003.5258
  C 208.47990000000001,1007.2463 222.00790000000003,1005.1682 232.46200000000002 1005.1044
  C 257.92490000000004,1004.9488 284.27520000000004,1001.4742000000001 308.9875 995.4157
  C 328.3833,990.6606 346.6556,981.3702000000001 365.8835 975.9854
  C 400.3152,966.3427 435.2533,968.6832 470.2961 962.907
  C 504.398,957.2859000000001 537.2426,945.7501000000001 571.2668 939.5104
  C 593.5531,935.4233 616.0953,933.4287 638.424 929.628
  C 673.3922,923.6758000000001 707.4997999999999,914.1706 742.2242 907.2478000000001
  C 760.6591999999999,903.5725000000001 779.8217,904.4212000000001 797.9793999999999 899.3923000000001
  C 814.2804,894.8776000000001 828.8861999999999,883.1945000000001 843.933 875.5749000000001
  C 855.1938,869.8725000000001 867.691,865.8516000000001 876.2094 855.9866000000001
  C 889.5423999999999,840.5457000000001 888.1604,813.5527000000001 888.8859 795.0345000000001
  C 890.2051,761.3606000000001 894.7913,728.6980000000001 899.0382999999999 695.3364000000001
  C 903.1179999999999,663.2892000000002 906.2796,631.9453000000001 915.1407999999999 600.6982000000002
  C 918.1175,590.2017000000002 924.6928999999999,581.8445000000002 929.0230999999999 572.1977000000002
  C 931.1901999999999,567.3698000000002 929.0230999999999,555.2096000000001 929.0230999999999 550.3740000000001
  C 929.0230999999999,536.6260000000001 929.0230999999999,522.8781000000001 929.0230999999999 509.13010000000014
  C 929.0230999999999,481.51800000000014 924.1542999999999,455.02140000000014 920.2006999999999 427.77550000000014
  C 917.2543999999999,407.47140000000013 916.7331999999999,385.60270000000014 911.6983999999999 365.69870000000014
  C 903.7118999999999,334.1259000000001 897.3069999999999,302.90880000000016 893.9313999999998 270.36270000000013
  C 889.6928999999998,229.49630000000013 883.2614999999998,189.4674000000001 876.9490999999998 148.83200000000014
  C 873.7099999999998,127.98040000000013 870.2780999999998,124.58400000000013 862.6789999999999 107.50570000000013
  C 861.5435999999999,104.95390000000013 859.9912999999999,96.41870000000013 857.3227999999999 94.65640000000013
  C 855.0742999999999,93.17150000000014 845.3824999999999,94.62840000000013 843.4014 94.62840000000013
  C 831.3494999999999,94.62840000000013 819.4232,93.38830000000013 807.3692 93.15100000000012
  C 755.5426,92.13090000000012 703.588,93.15100000000012 651.7519 93.15100000000012
  C 610.5437,93.15100000000012 569.4984,92.92710000000012 528.3714 96.02990000000013
  C 476.0731,99.97550000000012 424.2923,108.26180000000012 372.2732 114.61770000000013
  C 321.1654,120.86220000000013 269.98749999999995,123.72610000000013 219.03309999999996 131.56220000000013
  C 172.15159999999997,138.77200000000013 122.33329999999997,134.49600000000012 76.22229999999996 145.46030000000013
  C 75.40909999999997,145.65370000000013 76.22229999999996,147.13210000000012 76.22229999999996 147.96800000000013
  C 76.22229999999996,151.06930000000014 76.03069999999997,154.17650000000012 76.22229999999996 157.27180000000013
  C 77.33819999999996,175.30200000000013 86.57279999999996,193.40290000000013 92.41149999999996 210.15260000000012
  C 102.87419999999996,240.16730000000013 112.96549999999996,269.59320000000014 126.74809999999997 298.3348000000001
  C 144.16399999999996,334.6532000000001 164.13739999999996,369.09890000000007 177.56709999999998 407.2476000000001
  C 194.81529999999998,456.2435000000001 200.8438,507.66280000000006 209.33459999999997 558.6713000000001
  C 218.84649999999996,615.8141 230.83309999999997,671.5984000000001 233.12669999999997 729.6120000000001
  C 233.96149999999997,750.7262000000001 231.72519999999997,772.0745000000001 233.12669999999997 793.1540000000001
  C 234.12779999999998,808.2121000000001 236.71809999999996,823.2170000000001 236.71809999999996 838.3082000000002
  C 236.71809999999996,854.0679000000001 233.06309999999996,879.8808000000001 236.71809999999996 894.4811000000002
  C 236.95059999999995,895.4099000000002 238.22049999999996,893.2895000000002 239.02189999999996 892.7657000000002
  C 240.34829999999997,891.8987000000002 241.59979999999996,890.8934000000002 243.02649999999997 890.2038000000001
  C 245.68679999999998,888.9181000000001 248.37789999999998,887.6094000000002 251.23659999999998 886.8623000000001
  C 260.9154,884.3327000000002 275.6764,883.4779000000001 284.93859999999995 882.7206000000001
  C 325.72049999999996,879.3863000000001 365.80609999999996,874.3804000000001 406.09459999999996 867.0455000000001
  C 465.24309999999997,856.2769000000001 525.1488999999999,845.8358000000001 584.9561 839.3032000000001
  C 619.7345,835.5044 654.6722,832.0490000000001 689.5044 828.5472000000001
  C 698.2914000000001,827.6638 707.4667000000001,828.7327000000001 716.1483000000001 827.0719000000001
  C 745.4784000000001,821.4612000000002 768.4732,802.2147000000001 795.349 790.6345000000001
  C 808.8489000000001,784.8177000000002 822.812,783.8601000000001 836.8356 781.1162000000002
  C 837.0078,781.0825000000002 838.4715,773.4157000000001 838.5714 772.7410000000002
  C 839.9892000000001,763.1659000000002 840.4271,753.6995000000002 840.4271 744.0262000000002
  C 840.4271,706.4864000000002 835.6656,668.3112000000002 829.4356 631.2453000000003
  C 821.0419,581.3061000000002 802.5533,533.4430000000002 789.7845 484.4594000000003
  C 770.664,411.1095000000003 752.9381999999999,337.3820000000003 733.1237 264.22510000000034
  C 725.2687999999999,235.22420000000034 711.687,209.68770000000035 703.783 181.32070000000033
  C 701.3736,172.67360000000033 699.0668000000001,152.61690000000033 691.5572 146.7440000000003
  C 689.9376,145.47730000000033 684.3062,146.01150000000032 682.7452999999999 146.1855000000003
  C 668.1012,147.8178000000003 653.3676999999999,148.9057000000003 638.8581999999999 151.4725000000003
  C 615.4377999999999,155.61580000000032 592.7937999999999,163.4945000000003 569.4156999999999 167.8699000000003
  C 474.4903999999999,185.6358000000003 378.4118999999999,175.9057000000003 282.9110999999999 186.19560000000033
  C 260.77789999999993,188.58040000000034 238.89679999999993,192.40870000000032 216.62519999999992 193.32930000000033
  C 206.7523999999999,193.73740000000032 191.3868999999999,193.03730000000033 182.8877999999999 198.99940000000032
  C 178.13109999999992,202.33620000000033 181.94519999999991,210.59460000000033 181.94519999999991 216.4049000000003
  C 181.94519999999991,241.46250000000032 180.80659999999992,254.2773000000003 187.50379999999993 281.0013000000003
  C 200.94109999999992,334.6206000000003 218.69789999999992,389.9204000000003 238.70109999999994 441.95500000000027
  C 248.17399999999995,466.5969000000003 259.65279999999996,490.39440000000025 268.99229999999994 515.0898000000003
  C 285.2912999999999,558.1872000000003 294.3896,602.7523000000003 303.5238999999999 647.7525000000003
  C 308.2890999999999,671.2281000000003 310.90719999999993,698.6128000000003 321.1946999999999 720.4192000000003
  C 322.9828999999999,724.2096000000003 329.6451999999999,719.3462000000003 333.4399999999999 717.5675000000002
  C 345.2957999999999,712.0104000000002 352.2617999999999,707.0122000000002 365.1562999999999 702.5196000000002
  C 399.19979999999987,690.6584000000001 411.87199999999984,687.5350000000002 443.09409999999986 680.1763000000002
  C 472.71179999999987,673.1958000000002 501.96929999999986,666.5224000000002 532.2848999999999 663.4648000000002
  C 568.3673999999999,659.8256000000002 606.9033999999999,664.8866000000002 642.1482999999998 655.2437000000002
  C 663.9125999999999,649.2891000000002 681.0865999999999,637.2694000000002 699.3036999999998 625.3738000000002
  C 701.2101999999999,624.1289000000002 699.4267999999998,620.8211000000002 699.4267999999998 618.5441000000002
  C 699.4267999999998,606.2167000000002 699.4267999999998,593.8893000000002 699.4267999999998 581.5619000000002
  C 699.4267999999998,528.8713000000001 697.4813999999999,503.00150000000014 684.8074999999999 449.26350000000014
  C 673.9464999999999,403.21250000000015 656.8654999999999,362.2772000000001 636.9035999999999 319.6332000000001
  C 633.2178999999999,311.7596000000001 630.4882999999999,302.5571000000001 625.8317999999998 295.0924000000001
  C 625.4264999999998,294.4426000000001 619.3678999999998,295.6253000000001 619.3669999999998 295.6255000000001
  C 607.7530999999999,298.5004000000001 596.5307999999999,303.5929000000001 585.1672999999998 307.2122000000001
  C 543.0171999999999,320.6370000000001 499.55359999999985,332.53910000000013 456.4463999999998 342.4925000000001
  C 451.7975999999998,343.5659000000001 438.1094999999998,346.72930000000014 432.2272999999998 347.4144000000001
  C 401.0909999999998,351.0410000000001 366.1661999999998,338.2254000000001 342.3986999999998 365.3581000000001
  C 340.0180999999998,368.0757000000001 346.16329999999977,402.6013000000001 346.3118999999998 403.2671000000001
  C 353.99589999999984,437.68160000000006 364.5183999999998,471.7387000000001 373.5818999999998 505.7981000000001
  C 382.1544999999998,538.0130000000001 390.6735999999998,570.2828000000001 399.7199999999998 602.3694
  C 400.3198999999998,604.4972 403.7192999999998,620.3444000000001 407.7466999999998 622.6267
  C 414.2115999999998,626.2903 429.5781999999998,614.3331000000001 433.0134999999998 612.5541000000001
  C 458.5911999999998,599.3081000000001 484.8124999999998,592.1973 513.5890999999998 590.1453
  C 553.3176999999998,587.3123 588.9725999999998,588.9736 626.7437999999999 577.2203000000001
  C 637.3788999999998,573.9109000000001 649.8329999999999,572.2618000000001 658.2915999999999 564.4434000000001
  C 663.4602999999998,559.6659000000001 662.2577999999999,550.1167000000002 662.2797999999999 544.1027000000001
  C 662.3406999999999,527.4969000000001 662.4170999999999,510.8763000000001 662.2797999999999 494.2715000000001
  C 662.0994,472.4606000000001 661.4074999999999,450.3675000000001 658.3448999999999 428.73860000000013
  C 656.8705,418.3256000000001 653.5569999999999,403.2781000000001 643.2574 397.51260000000013
  C 629.8403999999999,390.00210000000015 597.819,400.34700000000015 584.2474 402.3415000000001
  C 566.3093,404.9777000000001 548.62,406.73340000000013 530.8208 410.3228000000001
  C 525.3403,411.4280000000001 519.8534999999999,412.5093000000001 514.342 413.4477000000001
  C 513.3282,413.6203000000001 505.2699,413.28480000000013 505.2691 413.4477000000001
  C 505.2039,426.0600000000001 507.1633,437.0252000000001 511.5897 448.8202000000001
  C 514.0822,455.4620000000001 517.3675,462.10070000000013 520.2172 468.5960000000001
  C 524.1564000000001,477.5749000000001 528.6160191406251,496.4284073242189 534.323419140625 504.4608073242189
`
}
