/**
 * @global
 * @description
 *
 *    如果没有监测到引入了lodash，但是实际需要使用它里面的好些方法。这里将这些方法补全，防止报错。
 *    但是会覆盖 _ 这个命名。
 */
function buildLodash() {
  const handler = {
    /**
     * @method  类型判断： 判断传入的参数是不是数组类型
     * @param {*} o    待判断的对象
     * @returns  true  是数组对象   false  不是数组对象
     */
    isArray: (o) => Object.prototype.toString.call(o) === "[object Array]",
    /**
     * @method  类型判断： 判断传入的参数是不是String类型
     * @param {*} o 待判断的对象
     * @returns  true  是String对象   false  不是String对象
     */
    isString: (o) => Object.prototype.toString.call(o) === "[object String]",
    /**
     * @method  类型判断： 判断传入的参数是不是Boolean类型
     * @param {*} o 待判断的对象
     * @returns  true  是Boolean对象   false  不是Boolean对象
     */
    isBoolean: (o) => Object.prototype.toString.call(o) === "[object Boolean]",
    /**
     * @method  类型判断： 判断传入的参数是不是Function类型
     * @param {*} o 待判断的对象
     * @returns  true  是Function对象   false  不是Function对象
     */
    isFunction: (o) =>
      Object.prototype.toString.call(o) === "[object Function]",
    /**
     * @method  类型判断： 判断传入的参数是不是Date类型
     * @param {*} o 待判断的对象
     * @returns  true  是Date对象   false  不是Date对象
     */
    isDate: (o) => Object.prototype.toString.call(o) === "[object Date]",
    /**
     * @method  类型判断： 判断传入的参数是不是Object类型
     * @param {*} o 待判断的对象
     * @returns  true  是Date对象   false  不是Date对象
     */
    isObject: (o) => Object.prototype.toString.call(o) === "[object Object]",
    /**
     * @method  类型判断： 判断传入的参数是不是RegExp类型
     * @param {*} o 待判断的对象
     * @returns  true  是RegExp对象   false  不是RegExp对象
     */
    isRegExp: (o) => Object.prototype.toString.call(o) === "[object RegExp]",
    /**
     * @method  深拷贝
     * @param {*} o
     */
    cloneDeep: function (o) {
      var res;
      switch (typeof o) {
        case "undefined":
          break;
        case "string":
          res = o + "";
          break;
        case "boolean":
          res = !!o;
          break;
        case "number":
          res = o + 0;
          break;
        case "object":
          if (o == null) {
            res = null;
          } else {
            if (handler.isArray(o)) {
              res = [];
              handler.each(o, (v) => res.push(handler.cloneDeep(v)));
            } else if (handler.isDate(o)) {
              res = new Date();
              res.setTime(o.getTime());
            } else if (handler.isObject(o)) {
              res = {};
              handler.each(o, (v, k) => {
                res[k] = handler.cloneDeep(v);
              });
            } else if (handler.isRegExp(o)) {
              res = new RegExp(o);
            } else {
              res = o;
            }
          }
          break;
        default:
          res = o;
          break;
      }
      return res;
    },
    /**
     * 返回 值位于 数组 or 字符串 的下标
     * @param {*} a  数组 or 字符串
     * @param {*} v  待判断的值, 可以是单个字符，也可以是一个字符串
     * @returns      下标
     */
    indexOf: (a, v) => {
      let index = -1;
      handler.every(a, (a1, i) => {
        if (a1 == v) {
          index = i;
          return false;
        }
      });
      return index;
    },
    /**
     * 遍历数组 or 对象(这个回调函数的返回值对遍历没得影响)
     * @param {*} o   数组 or 对象
     * @param {*} cb  回调函数
     *   arg0   遍历值
     *   arg1   下标
     *   arg2   数组or对象
     */
    each: (o, cb) => {
      let key;
      //优先处理数组结构
      if (handler.isArray(o)) {
        for (key = 0; key < o.length; key++) {
          cb && handler.isFunction(cb) && cb(o[key], key, o);
        }
      } else {
        /**
         * for ...  in...
         * 遍历顺序不是从左到右的,数字key优先与字符串key
         * -- 来自知识星球球友的提醒
         */
        for (key in o) {
          cb && handler.isFunction(cb) && cb(o[key], key, o);
        }
      }
    },
    /**
     * 遍历数组 or 对象 直到迭代回调函数返回false 或者 迭代结束
     * 与上面的遍历不同
     * @param {*} o
     * @param {*} cb
     * @returns
     */
    every: (o, cb) => {
      let key;
      //优先处理数组结构
      if (handler.isArray(o)) {
        for (key = 0; key < o.length; key++) {
          if (cb && handler.isFunction(cb)) {
            if (cb(o[key], key, o) === false) break;
          }
        }
      } else {
        for (key in o) {
          if (cb && handler.isFunction(cb)) {
            if (cb(o[key], key, o) === false) break;
          }
        }
      }
    },
    /**
     * 字符串前后去空格
     * @param {*} s
     * @returns
     */
    trim: (s) => $.trim(s),
    /**
     * 参数合并
     * 值得注意的是，与lodash不同 - jq的后面的参数没有值 它就不以最后一个为准了。所以后面的值必须给出默认值''
     */
    assign: (...params) => $.extend.call(this, ...params),
    /**
     * 用标点符号将数组拼接起来
     * @param {*} a  数组
     * @param {*} m  拼接字符
     * @returns
     */
    join: (a, m) => {
      var res = "";
      handler.each(a, (v) => {
        res += String(v) + m;
      });
      if (res != "") res = res.substring(0, res.length - m.length);
      return res;
    },
    /**
     *  数组过滤，返回回调为true的数组。 返回的是一个全新的数组
     * @param {*} o   数组对象
     * @param {*} cb  回调函数
     * @returns
     */
    filter: (o, cb) => {
      var res = [];
      _lodash.each(o, function (v, k) {
        if (cb && handler.isFunction(cb)) {
          if (cb(v, k, o)) res.push(v);
        }
      });
      return res;
    },
    /**
     *  数组转换，返回回调值的数组。 返回的是一个全新的数组
     * @param {*} o   数组对象
     * @param {*} cb  回调函数
     * @returns
     */
    map: (o, cb) => {
      var res = [];
      _lodash.each(o, function (v, k) {
        if (cb && handler.isFunction(cb)) {
          res.push(cb(v, k, o));
        }
      });
      return res;
    },
    /**
     * 字符串小驼峰,  这里简单处理成全部转成小写字符了
     * @param {*} s  待转化字符
     * @returns      转化后的字符
     */
    camelCase: (s) => String(s).toLowerCase(),
    /**
     * 反转数组,这里只好用原生的代替了
     */
    reverse: (a) => a.reverse(),
    /**
     * 数组排序
     * @param {*} array  待排序数组
     * @param {*} cb     回调函数
     * @returns
     */
    sortBy: (array, cb) => {
      if (!handler.isArray(array)) {
        let temp = [];
        handler.each(array, (v) => temp.push(v));
        array = temp;
      }
      return array.sort(function (a, b) {
        return cb(b) - cb(a);
      });
    },
    /**
     * 遍历数组, 移除回调函数返回为true的项，并将被移除的项返回
     * 也就是说它会修改原来的数组，只保留返回值不为true的。
     * 哪些返回值为true的会封装到一个新的数组里面返回
     * @param {*} o
     * @param {*} cb
     */
    remove: function (o, cb) {
      let res = [];
      handler.each(o, function (v, k, a) {
        if (cb && handler.isFunction(cb)) {
          if (!!cb(v, k, o)) {
            res.push(v);
            a.splice(k, 1);
          }
        }
      });
      return res;
    },
    /**
     * 获取对象的所有key
     */
    keys: (o) => Object.keys(o),
    /**
     * 检查字符串s是否以字符 t 打头
     * @param {*} s
     * @param {*} t
     * @returns
     */
    startsWith: (s, t) => String(s).startsWith(t),
    /**
     * 判断两个对象是否相等
     * @param {*} o0
     * @param {*} o1
     */
    isEqual: (o0, o1) => {
      // 参数有一个不是对象 直接判断值是否相等就行
      if (!handler.isObject(o0) || !handler.isObject(o1)) return o0 === o1;
      // 先比较keys的个数，如果个数不相同 直接就不相等了
      if (handler.keys(o0).length !== handler.keys(o1).length) return false;
      // 以o0为基准 和 o1依次递归比较
      for (let key in o0) {
        const res = handler.isEqual(o0[key], o1[key]);
        if (!res) return false;
      }
      return true;
    },
    /**
     * 防抖
     * @param {*} isClear 传入一个函数,则第二个参数是一个配置项;传入一个boolean,则代表阻止第二个参数(函数)的执行
     * @param {*} fn 配置项 or 执行函数
     */
    debounce: (isClear, fn) => {
      if (!handler.isFunction(isClear)) {
        fn._throttleID && clearTimeout(fn._throttleID);
      } else {
        handler.debounce(true, isClear);
        var param = handler.assign({ context: null, args: [], time: 300 }, fn);
        isClear._throttleID = setTimeout(function () {
          isClear.apply(param.context, param.args);
        }, param.time);
      }
    },
  };
  return handler;
}
// 引入自定义的lodash
if (!window._lodash) window._lodash = buildLodash();
