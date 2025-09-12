/**
 * layui-framework 主页配置
 * @license MIT
 * @Author Malphite
 * @Date 2023-09-15
 */
layui.define(["jquery", "element", "layer", "util"], function (exports) {
  // 初始化jQuery
  if (!window.$) window.$ = layui.$;
  /**
   * 窗口的jq对象
   */
  let $root = $(window);
  /**
   * body的jq对象
   */
  let $body = $("body");
  /**
   * 当前容器的jq对象
   */
  let $container = $body.find("#lay-framework");
  /**
   * 选项卡组的jq对象
   */
  let $tabGroup = $body.find("#lay-framework-tab-title");
  /**
   * iframe区域组的jq对象
   */
  let $bodyGroup = $body.find("#lay-framework-tab-body");
  /**
   * 初始化全屏的调用
   */
  let ele = document.documentElement;
  let reqFullScreen =
    ele.requestFullScreen ||
    ele.webkitRequestFullScreen ||
    ele.mozRequestFullScreen ||
    ele.msRequestFullscreen;
  /**
   * 展开or收缩菜单的icon标签的样式类名
   */
  const ICON_SHRINK = "layui-icon-shrink-right";
  const ICON_SPREAD = "layui-icon-spread-left";
  /**
   * chrome与phone 展开or收缩菜单的样式类名
   */
  const APP_SPREAD_SM = "layadmin-side-spread-sm";
  const SIDE_SHRINK = "layadmin-side-shrink";
  // layui-this
  const THIS = "layui-this";
  const SIDE_NAV_ITEMD = "layui-nav-itemed";
  /**
   * iframe的class名称
   */
  const ELEM_IFRAME_CLASS = "layadmin-iframe";

  /**
   * @constructor 双向链表节点对象
   * @param {*} key
   * @param {*} value
   */
  function bidirectionalLinkedListNode(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }

  /**
   * @constructor 页面配置项缓存
   * @param {*} capacity 缓存上限
   */
  function lruCache(capacity = 64) {
    this.capacity = capacity;
    this.size = 0;
    this.cache = {};
    // 创建一个空的伪头部节点
    this.head = new bidirectionalLinkedListNode();
    // 创建一个空的伪尾部节点
    this.tail = new bidirectionalLinkedListNode();
    this.head.next = this.tail;
    this.tail.prev = this.head;

    /**
     * @method 获取缓存中key所对应的值
     * @param {*} key
     * @returns key - 对应的值
     */
    this.get = function (key) {
      var node = this.cache[key];
      if (!node) return null;
      // 如果key存在值,先通过hash表进行定位,再移动到头部
      this._moveToHead(node);
      return node.value;
    };

    /**
     * @method 获取缓存中key所对应的值(仅获取,不涉及缓存操作)
     * @param {*} key
     * @returns key - 对应的值
     */
    this.touch = function (key) {
      var node = this.cache[key];
      return node ? node.value : null;
    };

    /**
     * @method 向缓存中放入 key - value
     * @param {*} key
     * @param {*} value
     * @returns tail.value
     * @desc 如果缓存达到容量上限会删除最近最少使用的一项，并返回它所对应的value(改为这个节点)
     * 返回的信息是缓存中删除的项，可以用来提醒删除对应的信息,达到缓存一致的效果
     */
    this.put = function (key, value) {
      var node = this.cache[key];
      if (!node) {
        // 如果key不存在值,创建一个新的节点
        var newNode = new bidirectionalLinkedListNode(key, value);
        // 添加进hash表
        this.cache[key] = newNode;
        // 添加进双向联表的头部
        this._addToHead(newNode);
        this.size++;
        if (this.size > this.capacity) {
          // 如果超过容量,删除双向联表的尾部节点
          var tail = this._removeTail();
          // 删除hash表中对应的项
          delete this.cache[tail.key];
          this.size--;
          return tail;
        }
      } else {
        //  如果 key 存在,先通过hash表定位,再修改 value, 并移动到头部
        node.value = value;
        this._moveToHead(node);
      }
    };

    /**
     * @method 通过key删除对应缓存
     * @param {*} key
     * @returns 被删除的节点 or null
     */
    this.remove = function (key) {
      var node = this.cache[key];
      if (node) {
        this._removeNode(node);
        delete this.cache[key];
        this.size--;
      }
      return node;
    };

    this._addToHead = function (node) {
      node.prev = this.head;
      node.next = this.head.next;
      this.head.next.prev = node;
      this.head.next = node;
    };

    this._removeNode = function (node) {
      node.prev.next = node.next;
      node.next.prev = node.prev;
    };

    this._moveToHead = function (node) {
      this._removeNode(node);
      this._addToHead(node);
    };

    this._removeTail = function () {
      var res = this.tail.prev;
      this._removeNode(res);
      return res;
    };
  }

  /**
   * @namespace rollPage
   * @private
   * @desc  实现选项卡定位逻辑
   *
   * 这里的逻辑是完全照搬layuiAdmin里面的
   */
  let rollPage = {
    /**
     * 将内容向右边移动一个可视化距离
     * root.outerWidth()  可视化距离
     * prefLeft 下一步还能藏多远的距离，如果是正数说明不太够了，将第一项 left=0 的都要抽出来。
     */
    left: function (root, index) {
      // 1.首先获取到 菜单条  它距离容器左侧的距离
      let tabsLeft = parseFloat(root.css("left"));
      /**
       * 2.判断这个距离tabsLeft的值(这个值只能是小于等于00)
       *  情况一、这个值是等于0的，说明菜单条的左侧已经已经不能再向右边移动了。直接返回，不做改变
       * (仅仅使用  !tabsLeft  可能是 ''  或者 null  如果是 == 0 也不行 '' == 0 也是true
       *  所以满足 !tabsLeft 和  <= 0 两种条件的就只有 数字 0 了)
       *  情况二、这个值小于0
       */
      if (!tabsLeft && tabsLeft <= 0) return;
      /**
       * 3.计算需要移动的距离
       *  到此 tabsLeft必然小于0 ， root.outerWidth()菜单可视宽度是大于0 的
       *  -(tabsLeft + root.outerWidth())    ==>  - -tabsLeft  - root.outerWidth();
       *  - -tabsLeft 是菜单条超过左侧的距离
       *  那么prefLeft的实际意义是  菜单条 向右移动一个 菜单可视宽度，此时  菜单条和容器左侧的距离
       *
       *
       *
       *  prefLeft：首先使用菜单可视宽度(root.outerWidth())加上tabsLeft,得到移动后，原来展示的信息可保留的最大距离
       *    ( 相当于可视距离减去移动被替换的距离，得到剩下可保留的原来的最大距离 )
       *    因为这个tabsLeft必然小于0，所以最后的结果必然小于 root.outerWidth()
       *    情况一、如果这个距离大于0等于0，你左边超出的部分，菜单可视宽度完全可以展示出来，说明只需要把左边超出的部分移动展示出来。
       *    情况二、如果这个距离小于0，说明你左边超出的部分，要想一次展示出来，整个菜单可视距离都利用上还不够，只能展示一部分。
       */
      let prefLeft = -(tabsLeft + root.outerWidth());
      // if (prefLeft >= 0) return root.css("left", 0);
      /**
       * 现在假设 强行将菜单的left设置为了0，菜单的左侧就对齐了，那么右侧会超出来一大截，超出的距离就是 prefLeft的等值
       * 此时
       * 依次遍历所有的li标签  它们left值第一个是0 后面慢慢增大
       * 当left值增加到等于或者超过 ‘prefLeft的等值’ 时，此时如果这个点处在菜单可视化左侧的0点，可以认为这样就刚刚好向右移了一个可视化距离
       *       a                b
       * |__________________|_________|   如果想求a比比长多少，可以将两个线段重合起来比较
       *               a-b
       * |___________|______|
       */
      root.children("li").each(function (index, item) {
        let li = $(item),
          left = li.position().left;
        if (left >= prefLeft) {
          root.css("left", -left);
          return false;
        }
      });
    },
    /**
     * 将所选中的内容展示到菜单可视范围内
     */
    auto: function (root, index) {
      let tabsLeft = parseFloat(root.css("left"));
      // 获得被选中li标签
      let thisLi = root.find('[lay-id="' + index + '"]');
      if (!thisLi[0]) return;
      let thisLeft = thisLi.position().left;
      // tabsLeft 必然是一个负数  -tabsLeft 指的是root藏住的长度
      // 如果 thisLeft < -tabsLeft 代表这个li被藏在左边了
      // 那就直接把它放在左边第一个的位置
      if (thisLeft < -tabsLeft) {
        return root.css("left", -thisLeft);
      }
      // thisLeft + thisLi.outerWidth() 指的是li标签的尾部到root头部的距离
      // outerWidth - tabsLeft 指的是可视的尾部到root头部的距离
      // li被藏在了右边看不全
      if (thisLeft + thisLi.outerWidth() >= root.outerWidth() - tabsLeft) {
        // 计算被藏住的长度
        let subLeft =
          thisLeft + thisLi.outerWidth() - (root.outerWidth() - tabsLeft);
        root.children("li").each(function (i, item) {
          let li = $(item),
            left = li.position().left;
          if (left + tabsLeft > subLeft) {
            root.css("left", -left);
            return false;
          }
        });
      }
    },
    /**
     * 将内容向左边移动一个可视化距离
     */
    right: function (root, index) {
      let tabsLeft = parseFloat(root.css("left"));
      // left + li.outerWidth() li标签的位置
      // root.outerWidth() - tabsLeft 被展示到的最远位置
      // 将第一个在右边被遮住的li放在第一个展示
      root.children("li").each(function (index, item) {
        let li = $(item),
          left = li.position().left;
        if (left + li.outerWidth() >= root.outerWidth() - tabsLeft) {
          root.css("left", -left);
          return false;
        }
      });
    },
  };

  /**
   * @method 打开弹出层
   * @param {*} key  LAYER_CONFIG里面的key
   * @param {*} data
   * @desc
   *    主要是将url参数进行请求放入content配置项中
   *    然后再调用方法，打开弹层
   * @returns
   */
  layui.openLayer = function (key, data) {
    let option;
    if (_lodash.isString(key)) {
      let _option = LAYER_CONFIG[key];
      option = {
        id: key,
        title: _option.name || key,
        type: _option.type || 1,
        shade: _option.shade || 0.1,
        shadeClose: _option.shadeClose || true,
        url: _option.url,
        anim: _option.anim || 0,
        area: _option.area,
        offset: _option.offset || "auto",
        success: _option.success,
        end: _option.end,
      };
      if (_option.content) option.content = _option.content;
      if (!_option.success)
        option.success = function (layero, index, layopt) {
          layui.use(key, function () {
            layui[key][handler.MAIN_METHOD_NAME] &&
              layui[key][handler.MAIN_METHOD_NAME](
                layero,
                index,
                layopt,
                data,
                layui
              );
          });
        };
      if (!_option.end)
        option.end = function () {
          layui[key] &&
            layui[key][handler.DESTROY_METHOD_NAME] &&
            layui[key][handler.DESTROY_METHOD_NAME]();
        };
    } else {
      option = key;
    }
    if (!option.url) return layui.layer.open(option);
    $.get(option.url, {}, (r) => {
      // TODO 处理html内容
      option.content = r;
      layui.layer.open(option);
    });
  };

  /**
   * @method 打开弹出层(抽屉层)
   * @param {*} key  LAYER_CONFIG里面的key
   * @param {*} data
   * @desc
   *    主要是将url参数进行请求放入content配置项中
   *    然后再调用方法，打开弹层
   * @returns
   */
  layui.openPopup = function (key, data) {
    let option;
    if (_lodash.isString(key)) {
      let _option = LAYER_CONFIG[key];
      option = {
        id: key,
        title: _option.name || key,
        type: _option.type || 1,
        shade: 0.1,
        shadeClose: true,
        url: _option.url,
        area: _option.area || ["320px", "100%"],
        anim: "slideLeft", // 从右往左
        offset: "r",
        success: _option.success,
        end: _option.end,
      };
      if (_option.content) option.content = _option.content;
      if (_lodash.isArray(_option.area))
        option.area = [_option.area[0], "100%"];
      if (!_option.success)
        option.success = function (layero, index, layopt) {
          layui.use(key, function () {
            layui[key][handler.MAIN_METHOD_NAME] &&
              layui[key][handler.MAIN_METHOD_NAME](
                layero,
                index,
                layopt,
                data,
                layui
              );
          });
        };
      if (!_option.end)
        option.end = function () {
          layui[key] &&
            layui[key][handler.DESTROY_METHOD_NAME] &&
            layui[key][handler.DESTROY_METHOD_NAME]();
        };
    } else {
      option = key;
    }
    return layui.openLayer(option, data);
  };

  /**
   * 定义模块返回对象
   */
  let handler = {
    /**
     * iframe入口方法名称
     */
    MAIN_METHOD_NAME: "run",
    /**
     * iframe销毁方法名称
     */
    DESTROY_METHOD_NAME: "destroy",
    /**
     * 侧边的菜单栏当前是否展开
     * true展开
     * false收缩
     */
    spread: true,
    /**
     * iframe配置项缓存 保存的类似于一个key - value形式的map
     * key 可以是点击页面的一个id(可能是字符串)
     * value 值的可以是一个不断提升的数字，和页面上面的tab页面控制的id和iframe区域的div的属性挂钩
     */
    cache: new lruCache(),
    /**
     * 当前是否固定首页
     * true 是
     * false 否
     */
    fixedHomePage: true,
    /**
     * 全局iframe页面编号
     */
    INTERVAL_INDEX: 1,
    /**
     * 缓存所有页面的resize事件
     */
    resizeFn: {},
    /**
     * 为key代表的窗口添加窗口resize事件
     * @param {*} key 窗口的id,就是菜单调用时的key
     * @param {*} fn 回调函数
     * @param {*} immediate 是否立即执行回调,默认false
     * @returns
     */
    resize: function (key, fn, immediate) {
        let _key = key == "frame" || key == "console" ? key : handler.cache.get(key);
        if (!_key) return;
        if (handler.resizeFn[_key]) {
            $root.off("resize", handler.resizeFn[_key]);
            delete handler.resizeFn[_key];
        }
        if (!fn) return;
        immediate && fn(); // 立即执行回调
        handler.resizeFn[_key] = function(){
            _lodash.debounce(fn);
        };
        $root.on("resize", handler.resizeFn[_key]);
    },
    /**
     * 执行已缓存的窗口key的resize回调函数
     * @param {*} key 窗口的id,就是菜单调用时的key
     */
    doResize: function (key) {
      let _key = handler.cache.get(key);
      _key && handler.resizeFn[_key] && handler.resizeFn[_key]();
    },
    /**
     * 为key代表的窗口取消窗口resize事件
     * @param {*} key 窗口的id,就是菜单调用时的key
     * @returns
     */
    cancelResize: function (key) {
      return handler.resize(key);
    },
    /**
     * 将tab控制栏向左边移动
     */
    rollPageLeft: function () {
      rollPage.left($tabGroup);
    },
    /**
     * 将tab控制栏向右边移动
     */
    rollPageRight: function () {
      rollPage.right($tabGroup);
    },
    /**
     * 将当前编号index的tab栏移动到可视的区域
     * @param {*} index tab的编号
     */
    rollPageAuto: function (index) {
      rollPage.auto($tabGroup, index);
    },
    /**
     * 全屏
     */
    fullScreen: function () {
      reqFullScreen && reqFullScreen.call(ele);
    },
    /**
     * 退出全屏
     */
    exitScreen: function () {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    },
    /**
     * @method 控制侧边主菜单的展开和收缩
     * @param {*} status 标志 true 展开 false 收缩
     * @desc
     *    创建 {@linkplain handler.spread  展开和收缩的标志} 将传入的标志与之对比
     * 如果一致就不作处理,不一致在处理后将此标志进行修改
     */
    sideFlexible: function (status) {
      // if (handler.spread === status) return;
      var iconElem = $container.find("#lay-framework-flexible");
      // 设置状态，PC：默认展开、移动：默认收缩
      // 设置按钮的图标
      iconElem
        .removeClass(ICON_SPREAD)
        .removeClass(ICON_SHRINK)
        .addClass(status === true ? ICON_SHRINK : ICON_SPREAD);
      // 设置$container的样式,这个样式来影响侧边菜单的样式的
      $container.removeClass(status ? SIDE_SHRINK : APP_SPREAD_SM);
      if (status) {
        $container
          .removeClass(APP_SPREAD_SM)
          .addClass($root.width() < 768 ? APP_SPREAD_SM : "");
      } else {
        $container
          .removeClass(SIDE_SHRINK)
          .addClass($root.width() < 768 ? "" : SIDE_SHRINK);
      }
      // 修改状态
      handler.spread = status;
    },
    /**
     * 置顶iframe页面
     * @param {*} key 窗口的id,就是菜单调用时的key
     * @param {*} data 附加参数
     * @returns
     * @desc
     *   附加参数:
     *  - 如果是一个回调函数,就直接在这个方法中被调用
     *  - 如果是一个对象(数据),就出现在run方法的回调里面
     */
    setTop: function (key, data) {
      // 添加适应菜单位置
      handler.setMenustatus(key); 
      if ("0" === key) return handler.doFixedHomePage();
      if (!key) return;
      // 不再是固定首页状态
      handler.fixedHomePage = false;
      // 如果传入了一个函数,就在iframe就绪后执行这个函数
      if (_lodash.isFunction(data)) handler.invokeIframeFunction(key, data);
      return !handler.cache.get(key)
        ? handler.openTabsPage(key, data)
        : handler.doSetTop(handler.cache.get(key));
    },
    /**
     * 固定展示首页
     */
    doFixedHomePage: function () {
      // 更新固定首页状态
      handler.fixedHomePage = true;
      handler.doSetTop(0);
    },
    /**
     * 置顶iframe页面
     * @param {*} id 内部维护生成的id是div上面的属性值
     */
    doSetTop: function (id) {
      // 标签页当前高亮
      $tabGroup
        .find('[lay-id="' + id + '"]')
        .addClass(THIS)
        .siblings("." + THIS)
        .removeClass(THIS);
      // 页面当前置顶
      $bodyGroup
        .find('[lay-id="' + id + '"]')
        .addClass(THIS)
        .siblings("." + THIS)
        .removeClass(THIS); 
      // 标签页自动适应位置
      handler.rollPageAuto(id);  
    },
    setMenustatus: function(key){
      let list = $('#lay-framework-side-menu').children('li');
      list.each(function(index1, item1){
        var othis1 = $(item1);
        var data1 = {
          list: othis1.children('.layui-nav-child'),
          a: othis1.children('*[lay-page-key]')
        };
        var listChildren1 = data1.list.children('dd');
        var matched1 = key === data1.a.attr('lay-page-key');

        listChildren1.each(function(index2, item2){
          var othis2 = $(item2)
          ,data2 = {
            list: othis2.children('.layui-nav-child'),
            a: othis2.children('*[lay-page-key]')
          }
          ,listChildren2 = data2.list.children('dd')
          ,matched2 = key === data2.a.attr('lay-page-key');
          
          listChildren2.each(function(index3, item3){
            var othis3 = $(item3)
            ,data3 = {
              list: othis3.children('.layui-nav-child'),
              a: othis3.children('*[lay-page-key]')
            }
            ,matched3 = key === data3.a.attr('lay-page-key');
            
            if(matched3){
              var selected = data3.list[0] ? SIDE_NAV_ITEMD : THIS;
              othis3.addClass(selected).siblings().removeClass(selected); //标记选择器
              return false;
            }
            
          });

          if(matched2){
            var selected = data2.list[0] ? SIDE_NAV_ITEMD : THIS;
            othis2.addClass(selected).siblings().removeClass(selected); //标记选择器
            return false
          }
          
        });

        if(matched1){
          var selected = data1.list[0] ? SIDE_NAV_ITEMD : THIS;
          othis1.addClass(selected).siblings().removeClass(selected); //标记选择器
          return false
        }
      });
    },
    /**
     * 打开并添加iframe页面
     * @param {*} key 窗口的id,就是菜单调用时的key
     * @param {*} data 附加参数
     * @returns
     * @desc
     *   附加参数:
     *  - 如果是一个回调函数,就忽略它，它会在{@linkplain handler.setTop 前置方法}中被处理
     *  - 如果是一个对象(数据),就出现在run方法的回调里面
     */
    openTabsPage: function (key, data) {
      // TODO CONFIG is undefine这个应该是页面的全局配置项
      var config = LAYER_CONFIG[key];
      if (!config) return;
      handler.INTERVAL_INDEX++;
      // 添加标签页
      let tabDom = document.createElement("li");
      tabDom.setAttribute("class", "lay-framework-tab");
      tabDom.setAttribute("lay-id", handler.INTERVAL_INDEX);
      tabDom.setAttribute("lay-page-key", key);
      let tabTxtDom = document.createTextNode("");
      tabTxtDom.textContent = config.name;
      tabDom.appendChild(tabTxtDom);
      let tabIconDom = document.createElement("i");
      tabIconDom.setAttribute("class", "layui-icon layui-icon-close");
      tabDom.appendChild(tabIconDom);
      $tabGroup.append(tabDom);
      // 添加iframe页
      let frameDom = document.createElement("div");
      frameDom.setAttribute("class", "layadmin-tabsbody-item");
      frameDom.setAttribute("lay-id", handler.INTERVAL_INDEX);
      let iframeDom = document.createElement("iframe");
      iframeDom.setAttribute("class", ELEM_IFRAME_CLASS);
      iframeDom.setAttribute("frameborder", "0");
      iframeDom.setAttribute("src", config.url);
      frameDom.appendChild(iframeDom);
      $bodyGroup.append(frameDom);
      // 添加缓存
      var _node = handler.cache.put(key, handler.INTERVAL_INDEX);
      // 这里等待执行iframe的主方法
      handler.invokeIframeMethod(key, handler.MAIN_METHOD_NAME, [
        $(iframeDom),
        handler.INTERVAL_INDEX,
        {},
        data && !_lodash.isFunction(data) ? data : {},
        layui,
      ]);
      // 这里添加iframe的resize方法
      handler.invokeIframeFunction(key, function () {
        iframeDom.contentWindow.layui[key]["resize"] &&
          handler.resize(key, iframeDom.contentWindow.layui[key]["resize"]);
      });
      // 这里添加iframe的右键点击事件
      handler.contextmenuTabsPage(key, tabDom);
      return _node
        ? handler.doCloseTabsPage(_node.key, _node.value)
        : handler.doSetTop(handler.INTERVAL_INDEX);
    },
    contextmenuTabsPage: function (key, tabDom) {
      // 1. 首先看看数据里面的情况
      let flag = true;
      let menus = [
        {
          title: "关闭",
          menuType: "close",
          id: "close",
        },
        {
          title: "关闭其它",
          menuType: "closeOther",
          id: "closeOther",
        },
        {
          title: "关闭全部",
          menuType: "closeAll",
          id: "closeAll",
        },
        // {
        //   title: "快捷菜单",
        //   menuType: "addTile",
        //   id: "#4",
        // },
        // { type: "-" },
        // {
        //   title: "添加到快捷菜单",
        //   id: "#3",
        //   child: [],
        // },
      ];
      // if (!layui.tileInstance || !layui.tileInstance.data) {
      //   flag = false;
      // } else {
      //   _lodash.every(layui.tileInstance.data, (struct) => {
      //     menus[5].child.push({
      //       id: struct.id,
      //       menuType: "insertTile",
      //       title: struct.name || "未命名",
      //     });
      //     _lodash.every(struct.source, (source) => {
      //       if (source.id == key) flag = false;
      //       return flag;
      //     });
      //     return flag;
      //   });
      // }
      // if(!flag){
      //   menus.pop();
      //   menus.pop();
      //   menus.pop();
      // } 
      layui.dropdown.render({
        elem: tabDom,
        id: handler.cache.touch(key),
        trigger: "contextmenu",
        isAllowSpread: false,
        data: menus,
        click: function (obj, othis) {
          let key = $(tabDom).attr('lay-page-key');
          if (obj.menuType === "close") {
            handler.closeTabsPage(key);
          } else if (obj.id === "closeOther") {
            handler.setTop(key);
            handler.closeOtherPage();
          } else if (obj.id === "closeAll") {
            handler.closeAllPage();
          } 
          
          // else if (obj.menuType == "insertTile"){
          //   let name = $(tabDom).text();
          //   layui.tileInstance.insertTile(obj.id, {id: key, name, name});
          //   layui.layer.msg('添加成功,请返回主页查看!', {icon: 6});
          //   // 重新绑定这个下拉菜单(非重载因为信息发生了改变),不知道这个操作会不会有问题
          //   handler.contextmenuTabsPage(key, tabDom);
          // } else if(obj.menuType == "addTile"){
          //   let name = $(tabDom).text();
          //   layui.tileInstance.addTile({id: key, name, name});
          //   layui.layer.msg('添加成功,请返回主页查看!', {icon: 6});
          //   // 重新绑定这个下拉菜单(非重载因为信息发生了改变),不知道这个操作会不会有问题
          //   handler.contextmenuTabsPage(key, tabDom);
          // }
        },
      });
    },
    /**
     * 关闭并删除iframe页面
     * @param {*} key 窗口的id,就是菜单调用时的key
     */
    closeTabsPage: function (key) {
      // 移除resize事件
      handler.cancelResize(key);
      // 删除缓存
      var node = handler.cache.remove(key);
      // 缓存删除成功之后删除对应的页面信息
      if (node) handler.doCloseTabsPage(node.key, node.value);
    },
    /**
     * 关闭并删除iframe页面
     * @param {*} key 窗口的id,就是菜单调用时的key
     * @param {*} id 内部维护生成的id是div上面的属性值
     * @desc
     *    与{@linkplain handler.closeTabsPage 公共的删除方法}不同的是：特意将剩下的删除内容
     * 抽到这个方法中,将删除缓存这一过程放到了上面的方法中。在添加新页面时,由于缓存容量有限,有可能
     * 会删除一些缓存,为了保持一致会调用这个方法来删除页面。此时由于缓存已经被删除了,需要跳过缓存删除
     * 这一步来调用删除页面。
     */
    doCloseTabsPage: function (key, id) {
      // 执行销毁前的回调
      handler.invokeIframeMethod(key, handler.DESTROY_METHOD_NAME);
      // 删除tab标签
      $tabGroup.find('[lay-id="' + id + '"]').remove();
      // 删除iframe页面
      $bodyGroup.find('[lay-id="' + id + '"]').remove();
      // 重新选择选中的标签
      let _value = handler.cache.head.next.value;
      return _value ? handler.doSetTop(_value) : handler.doFixedHomePage();
    },
    /**
     * 关闭并删除除当前选中之外的iframe页面
     */
    closeOtherPage: function () {
      // 首页不受缓存维护,所以是算作删除所有iframe页面
      if (handler.fixedHomePage) return handler.closeAllPage();
      // 获取当前页面信息
      let node = handler.cache.head.next;
      if (!node) return handler.closeAllPage();
      // var o = _lodash.cloneDeep(handler.cache.cache);
      _lodash.each(handler.cache.cache, (v, k) => {
        if (node.key != k) handler.closeTabsPage(k);
      });
    },
    /**
     * 关闭并删除除所有的iframe页面
     */
    closeAllPage: function () {
      // var o = _lodash.cloneDeep(handler.cache.cache);
      _lodash.each(handler.cache.cache, (v, k) => handler.closeTabsPage(k));
    },
    /**
     * 根据方法名称调用key代表的iframe页面的layui模块下面的方法
     * @param {*} key 窗口的id,就是菜单调用时的key
     * @param {*} methodName layui模块下面的方法名称
     * @param {*} args 补充的参数数组
     */
    invokeIframeMethod: function (key, methodName, args = []) {
      let id = handler.cache.touch(key) || 0;
      let iframe = $bodyGroup
        .find('[lay-id="' + id + '"]')
        .find("." + ELEM_IFRAME_CLASS)
        .get(0);
      handler.invokeIframeFunction(key, function () {
        iframe.contentWindow.layui[key][methodName] &&
          iframe.contentWindow.layui[key][methodName].apply(
            iframe.contentWindow.layui[key],
            args
          );
      });
    },
    /**
     * 在key代表的iframe页面的layui模块加载完毕后执行回调
     * @param {*} key 窗口的id,就是菜单调用时的key
     * @param {*} callback 模块加载完毕后执行的回调函数
     */
    invokeIframeFunction: function (key, callback) {
      let id = handler.cache.touch(key) || 0;
      let iframe = $bodyGroup
        .find('[lay-id="' + id + '"]')
        .find("." + ELEM_IFRAME_CLASS)
        .get(0);
      handler.touchLayuiMoudle(function () {
        return (
          iframe &&
          iframe.contentWindow &&
          iframe.contentWindow.layui &&
          iframe.contentWindow.layui[key]
        );
      }, callback);
    },
    /**
     * 条件变为true时执行回调函数
     * @param {*} condition 被观察的条件
     * @param {*} callback 回调函数
     * @desc 调用的方法参考{@linkplain layui.use 加载方法}里面的poll方法
     *  - 原方法检查的是模块是否成功加载,这个改为传入参数 condition
     *  - 共用{@linkplain layui.cache.timeout 超时系数 } ,使用layui.config({timeout:XXX})进行自定义
     * 用途: 这里用在{@linkplain handler.setTop 打开iframe页面} 时如果传入第二个参数就可以通过这个方法进行主窗口和iframe之间的联动
     */
    touchLayuiMoudle: function (condition, callback) {
      let timeOut = layui.cache.timeout || (60 * 1000) / 4;
      (function loop() {
        if (--timeOut < 0) {
          // console.error("Timeout when touchLayuiMoudle !");
        } else {
          condition()
            ? callback()
            : setTimeout(function () {
                loop(condition, callback);
              }, 40); // 总是出现时间不够的情况,这里次数不变,增大轮询的间隔
        }
      })();
    },
    /**
     * 添加页面监听的事件
     */
    addListener: function () {
      /**
       * 点击菜单小图标展开菜单
       */
      layui.element.on("nav(lay-framework-side-menu)", function (elem) {
        if (elem.siblings(".layui-nav-child")[0] && !handler.spread)
          handler.sideFlexible(!handler.spread);
      });

      /**
       * 窗口初始时过小的特殊处理,将这个监听事件放入window的resize事件中持续的监听
       */
      handler.resize(
        "frame",
        function () {
          handler.sideFlexible($root.width() < 768 ? false : true);
        },
        true
      );

      /**
       * 自定义的头部菜单事件
       */
      layui.util.event("lay-header-event", {
        // 伸缩
        flexible: function () {
          handler.sideFlexible(!handler.spread);
        },
        // 刷新
        refresh: function () {
          // 当固定首页标记为false并且缓存里面有页面时才会选择缓存里面的最新页面;否则取首页
          var id =
            !handler.fixedHomePage && !!handler.cache.head.next.value
              ? handler.cache.head.next.value
              : 0;
          var key =
            !handler.fixedHomePage && !!handler.cache.head.next.key
              ? handler.cache.head.next.key
              : 'console';
          var iframe = $bodyGroup
            .find('[lay-id="' + id + '"]')
            .find("." + ELEM_IFRAME_CLASS);
          // 首页采用传统方法吧,run方法改成自动执行,反正不会有别的操作去关闭和打开它
          if(handler.fixedHomePage || id == 0){
            iframe[0].contentWindow.location.reload(true);
            return;
          }  
          var option = iframe[0].contentWindow.layui[key] && iframe[0].contentWindow.layui[key].option;
          // 传统的这种方式完全不可以,因为打开窗口后需要主动调用run方法来渲染页面,不然光打开都是白的
          // iframe[0].contentWindow.location.reload(true);
          // 这里采用先关闭再打开的方式,希望可以解决
          handler.closeTabsPage(key);
          handler.setTop(key, option);
        },
        // 全屏or退出全屏
        fullscreen: function (othis) {
          var SCREEN_FULL = "layui-icon-screen-full",
            SCREEN_REST = "layui-icon-screen-restore",
            iconElem = othis.children("i");
          if (iconElem.hasClass(SCREEN_FULL)) {
            handler.fullScreen();
            iconElem.addClass(SCREEN_REST).removeClass(SCREEN_FULL);
          } else {
            handler.exitScreen();
            iconElem.addClass(SCREEN_FULL).removeClass(SCREEN_REST);
          }
        },
        // 主题设置
        theme: function () {
          layui.colortheme && layui.colortheme.popup();
        },
        //弹出关于面板 大于765像素
        about: function () {
          layui.openPopup({
            id: "home_doc",
            title: 'layui-framework介绍',
            type: 1,
            shade: 0.1,
            shadeClose: true,
            url: './plugin/layuiframework/html/doc.html',
            area: ["640px", "100%"],
            anim: "slideLeft", // 从右往左
            offset: "r",
            success: function(layero, index){
              layero.off('click', '*[lay-page-key]').on('click', '*[lay-page-key]', function(){
                var key = $(this).attr("lay-page-key");
                layui.layer.close(index)
                handler.setTop(key);
              });
            },
          });
        },
        //弹出更多面板 小于765像素
        more: function () {
          layui.openPopup({
            id: "home_doc",
            title: 'layui-framework介绍',
            type: 1,
            shade: 0.1,
            shadeClose: true,
            url: './plugin/layuiframework/html/doc.html',
            area: ["100%", "100%"],
            anim: "slideLeft", // 从右往左
            offset: "r",
            success: function(layero, index){
              layero.off('click', '*[lay-page-key]').on('click', '*[lay-page-key]', function(){
                var key = $(this).attr("lay-page-key");
                layui.layer.close(index)
                handler.setTop(key);
              });
            },
          });
        },
        // 关闭当前页
        closeThisTabs: function () {
          if (handler.fixedHomePage) return;
          // 从缓存中取出当前页的key值,然后再调用删除这个指定的页面
          let node = handler.cache.head.next;
          node && handler.closeTabsPage(node.key);
        },
        //关闭其它标签页
        closeOtherTabs: function () {
          handler.closeOtherPage();
        },
        //关闭全部标签页
        closeAllTabs: function () {
          handler.closeAllPage();
        },
        rollPageLeft: function(){
          handler.rollPageLeft();
        },
        rollPageRight: function(){
          handler.rollPageRight();
        },
      });

      /**
       * 主菜单点击事件
       */
      $body.on("click", "*[lay-page-key]", function () {
        var key = $(this).attr("lay-page-key");
        handler.setTop(key);
        if($root.width() < 768) handler.sideFlexible(!handler.spread);
      });

      /**
       * 选项卡关闭按钮点击事件
       */
      $tabGroup.on("click", ".layui-icon-close", function () {
        var key = $(this).parent().attr("lay-page-key");
        handler.closeTabsPage(key);
      });

      // 调用一下,主页调不到
      setTimeout(function () {
        let iframeDom = $bodyGroup
          .find('[lay-id="0"]')
          .find("." + ELEM_IFRAME_CLASS)
          .get(0);
        // 执行console主页iframe的run方法
        
        // handler.invokeIframeMethod("console", "run", [
        //   $(iframeDom),
        //   0,
        //   {},
        //   {},
        //   layui,
        // ]);
        // 这里添加console主页iframe的resize方法
        handler.invokeIframeFunction("console", function () {
          iframeDom.contentWindow.layui["console"]["resize"] &&
            handler.resize(
              "console",
              iframeDom.contentWindow.layui["console"]["resize"]
            );
        });
        // 初始化主题设置
        layui.theme && layui.theme.setTheme();
      }, 200);
    },
  };
  // 调用添加事件
  handler.addListener();
  // 主题监听事件修改
  const setTheme = layui.colortheme.setTheme;
  const setConfig = layui.colortheme.setConfig;
  layui.colortheme.setTheme = function(key){
      setTheme(key);
      // 修改首页
      var iframe = $bodyGroup.find('[lay-id="0"]').find("." + ELEM_IFRAME_CLASS).get(0);
      handler.touchLayuiMoudle(function () {
          return (
              iframe &&
              iframe.contentWindow &&
              iframe.contentWindow.layui &&
              iframe.contentWindow.layui.colortheme
          );
      }, function(){
          iframe.contentWindow.layui.colortheme.setTheme(key)
      });

      // 修改普通页面
      _lodash.each(handler.cache.cache, (v, k) => {
          let _iframe = $bodyGroup.find('[lay-id="'+ v.value +'"]').find("." + ELEM_IFRAME_CLASS).get(0);
          handler.touchLayuiMoudle(function () {
              return (
                  _iframe &&
                  _iframe.contentWindow &&
                  _iframe.contentWindow.layui &&
                  _iframe.contentWindow.layui.colortheme
              );
          }, function(){
              _iframe.contentWindow.layui.colortheme.setTheme(key)
          });
      });
  };

  layui.colortheme.setConfig = function(name, cnname, config){
      setConfig(name, cnname, config);
      // 修改首页
      var iframe = $bodyGroup.find('[lay-id="0"]').find("." + ELEM_IFRAME_CLASS).get(0);
      handler.touchLayuiMoudle(function () {
          return (
              iframe &&
              iframe.contentWindow &&
              iframe.contentWindow.layui &&
              iframe.contentWindow.layui.colortheme
          );
      }, function(){
          iframe.contentWindow.layui.colortheme.setConfig(name, cnname, config)
      });

      // 修改普通页面
      _lodash.each(handler.cache.cache, (v, k) => {
          let _iframe = $bodyGroup.find('[lay-id="'+ v.value +'"]').find("." + ELEM_IFRAME_CLASS).get(0);
          handler.touchLayuiMoudle(function () {
              return (
                  _iframe &&
                  _iframe.contentWindow &&
                  _iframe.contentWindow.layui &&
                  _iframe.contentWindow.layui.colortheme
              );
          }, function(){
              _iframe.contentWindow.layui.colortheme.setConfig(name, cnname, config)
          });
      });
  };

  // 获取地址信息

  function GetUrlParms(){
    var args = {};
    var code = decodeURIComponent(location.search);
    var query = code.substring(1);
    var pairs = query.split("&");
    Array.prototype.forEach.call(pairs, function (arg) {
      var pos = arg.indexOf('=');
      if (pos == -1) return true;
      var name = arg.substring(0, pos);
      var value = arg.substring(pos + 1);
      args[name] = unescape(value);
    });
    return args;
  }

  var urlParams = GetUrlParms();
  if(urlParams.fun){
    handler.setTop(urlParams.fun);
    if(urlParams.location){
      let id = handler.cache.touch(urlParams.fun);
      let iframe = $bodyGroup
        .find('[lay-id="' + id + '"]')
        .find("." + ELEM_IFRAME_CLASS)
        .get(0);
      handler.touchLayuiMoudle(function () {
        return (
          iframe &&
          iframe.contentWindow &&
          iframe.contentWindow.layui &&
          iframe.contentWindow.layui.outline
        );
      },function(){
        setTimeout(function(){
          iframe.contentWindow.layui.outline.location(urlParams.location);
        }, 300);
      });
    }
  }

  layui.colortheme.run();

  exports("frame", handler);
});
