/**
 * @function 表单增强
 * @since v0.0.1
 * @author Malphite
 * @desc
 *
 *  <p>在原有的{@link layui.form.render} 表单刷新渲染方法的前提下,在这个过程中添加更多的渲染机会,实现更多的需求功能</p>
 *  <p>简单原理:</p>
 *  <ul>
 *    <li>使用代理模式替换原有的方法,并在此方法之前和方法之后进行处理;其好处是,没有新增方法,可以降低学习成本</li>
 *    <li>额外使用一个js的object来映射表单,可以通过这个对象来间接控制表单</li>
 *  </ul>
 * 
 * 
 * 记录一下，初始化的变量定义值
 * 
 * 1. input(nomal) - input  string                output string
 * 2. selectTree -   input  string/array<string>  output string
 * 3. data         - input  string                output string
 * 4. checkbox     - input  array<string>         output string
 * 5. radio        - input  string                output string
 * 6. select       - input  string                output string
 * 7. switch       - input  boolean               output boolean
 * 
 * 新增converter
 *    renderer
 *    Proxy
 *    rollback
 *    onsync
 * 
 * 
 * TODO 数组型数据由于封装or对象的原因，新旧值始终不一致，始终触发change,出于性能考虑，不特殊判断了
 * 暂时不能解决的问题集合：
 * 同步问题: 
 *    在select 组件开启lay-serach功能后,如果在选择一个选项后，然后手动删除输入框里面的值:
 *      - 如果删到一半，输入框里面还有内容，此时点击其他地方取消下拉，select 会恢复原来的选项，这没有任何问题
 *      - 如果删完，输入框里面是空字符串 select 会将值设置为空字符串选项(如果有这一项)，这一步纯js实现，不会触发任何回调，因此会造成数据同步问题
 *    在 enableComplate 中的 blur 监听事件，在输入框失去焦点时又再次将数据进行同步就是为了避免这种情况
 *    但是在不启用这个功能的情况下，此bug依然存在。fromplus不会去修改 form的任何逻辑，所有取值时还是推荐使用 form的取值
 * 
 * 
 */
("use strict");
layui.disuse('formplus');
layui.define(["jquery", "lay", "layer", "form", "component"], function (exports) {

  // jquery的初始化
  const $ = layui.jquery;
  if (!window.$) window.$ = layui.$;

  /* 一、常量定义 */

  /**
   * @constant
   * 当前组件名称
   * @type {string}
   */
  const KEY = "formplus";

  /**
   * @constant
   * 检测环境是否支持 Proxy
   * @type {boolean}
   */
  const HAS_PROXY = typeof Proxy !== 'undefined';

  /**
   * @constant
   * 树组件选中选择的样式
   * @type {string}
   */
  const TREE_SELECTED_CSS = 'layui-form-selecttree-selected';

  /**
   * @constant
   * form表单中过滤表单项的属性名
   * @type {string}
   */  
  const LAYUI_FILTER = "lay-filter";

  /**
   * @constant
   * 标记form表单的样式名称
   * @type {string}
   */  
  const CLASS_FORM = "layui-form";

  /**
   * @constant
   * layui表单验证 是否懒校验的属性值
   * @type {string}
   * @description
   * <ul>
   *   <li>不设置这个属性 input采用 input onporpertychange 事件监听</li>
   *   <li>设置这个属性值 input采用 onbulr 事件监听</li>
   * </ul>
   */  
  const LAYUI_LAZY = "lay-lazy";

  /**
   * @constant
   * 标记form表单元素被 form 组件忽略的属性名称
   * @type {string}
   */
  const LAYUI_IGNORE = "lay-ignore";

  /**
   * @constant
   * 标记form表单元素被 formplus 组件忽略的属性名称
   * @type {string}
   */
  const LAYUI_IGNORE_PLUS = "lay-formplus-ignore";

  /**
   * @constant
   * 标记该表单元素被 formplus 组件识别为时间选择器的属性名称
   * @type {string}
   */
  const LAYUI_DATE = "laydate";

  /**
   * @constant
   * 标记该表单元素被 formplus 组件识别为已经被 laydate 组件渲染完毕的属性名称
   * @type {string}
   * @description
   * 这个属性的属性值是 laydate 组件的id
   */
  const LAYUI_ALREADY_DATE_1 = "lay-key";

  /**
   * @constant
   * 标记该表单元素被 formplus 组件识别为已经被 laydate 组件渲染完毕的属性名称
   * @type {string}
   */
  const LAYUI_ALREADY_DATE_2 = "lay-laydate-id";

  /**
   * @constant
   * 标记form表单元素用户填写配置项参数的属性名称
   * @type {string}
   */
  const LAYUI_OPTIONS = "lay-options";

  /**
   * @constant
   * layui.tree 组件渲染后标记实例ID的属性名称
   * @type {string}
   */
  const LAYUI_TREE_ID = "lay-tree-id";

  /**
   * @constant
   * 下拉框控制显示/隐藏的样式名前缀，后面追加 - up  or - ed
   * @type {string}
   */
  const CLASS_SELECT_STATE_PREFIX = "layui-form-select";

  /**
   * @constant
   * 下拉树组件中标记保存真实值的样式名称
   * @type {string}
   */
  const CLASS_SELECT_TREE_VALUE = "layui-select-tree-value";

  /**
   * @constant
   * 下拉树组件中标记前端显示值的样式名称
   * @type {string}
   */
  const CLASS_SELECT_TREE_TITLE = "layui-select-tree-title";

  /**
   * @constant
   * 下拉树组件外层容器骨架的样式名称(包裹 input)
   * @type {string}
   */
  const CLASS_SELECT_TREE_OUTER_TITLE = "layui-select-title";

  /**
   * @constant
   * 水波纹 INSET 的样式名称
   * @type {string}
   */
  const CLASS_WAVE_INSET_RIPPLES = "layui-inset-ripples";

  /**
   * @constant
   * 水波纹 OUT 的样式名称
   * @type {string}
   */
  const CLASS_WAVE_OUT_RIPPLES = "layui-out-ripples";

  /**
   * @constant
   * 水波纹 永久动画 的样式片段
   * @type {string}
   */
  const CLASS_WAVE_ALWAYS = "layui-animate-always";

  /**
   * @constant
   * 水波纹 一次动画 的样式片段
   * @type {string}
   */
  const CLASS_WAVE_ONCE = "layui-animate-once";

  /**
   * @constant
   * 多个值之间用于拼接的字符
   * @type {string}
   */
  const SEPARATOR_SYMBOL = ",";

  /**
   * 自定义下拉树默认配置项
   * @typedef {Object} selectTreeOptions
   * @property {string} url - AJAX 异步请求地址
   * @property {string} type - AJAX 异步请求方法 GET|POST|PUT|DELETE
   * @property {*} headers - AJAX 异步请求头对象
   * @property {string} dataType - AJAX 异步请求参数类型
   * @property {*} where - AJAX 异步请求参数
   * @property {string} statusName - AJAX 异步响应状态名
   * @property {number} statusCode - AJAX 异步响应状态(成功状态)
   * @property {string} dataName - AJAX 异步响应体名
   * @property {string} id - 对应 layu.tree 实例的ID
   * @property {Array} data - 对应 layu.tree 实例的数据源
   * @property {boolean} showCheckbox - 是否启用复选模式 
   * @property {boolean} checkbox - 复选模式下，是否在选择后关闭下拉框 
   * @property {boolean} onlyIconControl - 对应 layu.tree 实例的配置项 - 节点只用来触发点击事件 
   * @property {*} customName - 对应 layu.tree 实例的配置项 - 自定义 data 数据源中常用的字段名称
   */

  /**
   * @constant
   * 下拉树默认配置项
   * @type {selectTreeOptions}
   */
  const LAYUI_SELECT_TREE_OPTIONS = {
    /**
     * @inner
     * AJAX 异步请求地址
     * @type {String}
     */
    url: '',
    /**
     * @inner
     * AJAX 异步请求方法 GET|POST|PUT|DELETE
     * @type {String}
     */
    type: 'GET',
    /**
     * @inner
     * AJAX 异步请求头对象
     * @type {*}
     */
    headers: {},
    /**
     * @inner
     * AJAX 异步请求参数类型
     * @type {String}
     */
    dataType: 'json',
    /**
     * @inner
     * AJAX 异步请求参数
     * @type {*}
     */
    where: {},
    /**
     * @inner
     * AJAX 异步响应状态名
     * @type {String}
     */
    statusName: 'code',
    /**
     * @inner
     * AJAX 异步响应状态(成功状态)
     * @type {Number}
     */
    statusCode: 200,
    /**
     * @inner
     * AJAX 异步响应体名
     * @type {String}
     */
    dataName: 'data',
    /**
     * @inner
     * 对应 layu.tree 实例的ID
     * @type {String}
     */
    id: '',
    /**
     * @inner
     * 对应 layu.tree 实例的数据源
     * @type {Array}
     */
    data: [],
    /**
     * @inner
     * 是否启用复选模式 
     * @type {boolean}
     * @description 
     * 注意与 layui.tree 中同名属性区分
     */
    showCheckbox: false,
    /**
     * @inner
     * 复选模式下，是否在选择后关闭下拉框 
     * @type {boolean}
     * @description 
     * 注意与 layui.tree 中同名属性区分
     */
    checkbox: false,

    /**
     * @inner
     * 复选模式下，是否在获取到焦点后清空输入框 
     * @type {boolean}
     */
    clearOnFocus: false,
    /**
     * @inner
     * 对应 layu.tree 实例的配置项 - 节点只用来触发点击事件 
     * @type {boolean}
     */
    onlyIconControl: true,
    /**
     * @inner
     * 对应 layu.tree 实例的配置项 - 自定义 data 数据源中常用的字段名称
     * @type {*}
     */
    customName: {
      id: 'id',
      title: 'title',
      children: 'children',
      parentid: 'parentid',
    },
  };


  /* 二、变量定义 */

  /**
   * 公共服务定位器（Service Locator）
   * 
   * 用于注册和获取可动态调用的服务函数。
   * 
   * 设计目的：
   *   - 解耦组件与具体服务实现
   *   - 支持运行时动态注册与调用
   *   - 为 invokeServiceLocator 提供底层支持
   * 
   * 使用方式：
   *   - 通过 registerHandler 注册服务
   *   - 通过 invokeServiceLocator 调用服务
   * 
   * 注意：
   *   - 此对象为全局共享，所有实例共用同一服务池
   *   - 服务名（methodName）需全局唯一，避免冲突
   *   - 服务函数执行时，this 指向调用 invoke 的组件实例
   * 
   * @type {Object}
   */
  var publicServiceLocator = {
    /**
     * 注册一个服务
     * 
     * @param {String} name - 服务的唯一标识符
     * @param {Function} service - 服务函数，将在 invoke 时执行
     * @returns {Object} 返回自身，支持链式调用（虽未使用，但保留扩展性）
     */
    register: function(name, service) {
      this[name] = service;
      return this;
    },
    /**
     * 获取一个已注册的服务
     * 
     * @param {String} name - 服务名称
     * @returns {Function|undefined} 返回服务函数，若未注册则返回 undefined
     */
    get: function(name) {
      return this[name];
    }
  };

  /**
   * 全局公共渲染器列表
   * 
   * 存储所有通过 registerRenderer 注册的通用渲染器。
   * 查找顺序：在实例级渲染器未匹配时，作为兜底查找池。
   * 
   * 注意：
   *   - 所有元素应为 Renderer 实例
   *   - 由 registerRenderer 统一维护
   *   - 查找时按注册顺序遍历，先注册的优先级高
   * 
   * @type {Renderer[]}
   */
  var publicRenderers = [];

  var formRenderers = {
    /**
     * 普通输入框 (Input) 渲染器
     *
     * 用于识别并初始化标准的文本输入框（input）和文本域（textarea）。
     * 该渲染器负责建立输入框的值与表单数据模型之间的双向绑定，
     * 处理用户输入事件、字数限制、特殊修饰（affix）以及提交前的数据同步。
     * 它是处理基本文本输入的默认渲染器。
     *
     * @type {Renderer}
     *
     * @property {Function} match - 用于判断当前表单元素是否应由该渲染器处理的匹配函数。
     * @property {Function} render - 执行具体渲染逻辑的函数。
     */
    input: new Renderer(
      /**
       * 判断是否适用 input 渲染器
       * 
       * 此函数检查给定的表单元素是否为一个应由本渲染器处理的标准输入框。
       * 
       * @function
       * @param {HTMLElement} formItem - 表单元素
       * @param {string} formType - 表单类型
       * @param {string} type - 组件类型
       * @returns {boolean} 如果元素是 `input` 类型、**不是**时间选择器（date），并且**不是**下拉树（selectTree）标记元素，则返回 `true`；否则返回 `false`。
       * 
       * @description
       * 匹配规则如下：
       * 1.  **元素类型检查**：必须是 `input` 元素。
       * 2.  **排除时间选择器**：如果元素是 Layui 时间选择器，则排除，交由 `date` 渲染器处理。
       * 3.  **排除下拉树**：如果元素被 `isSelectTreeElement` 函数标记为下拉树元素，则排除，交由 `selectTree` 渲染器处理。
       * 4.  **默认兜底**：满足以上条件的 `input` 元素，均视为普通输入框，由本渲染器处理。
       */
      function (formItem, formType, type){
        // 类型必须是 input
        if (type && type != 'input') {
          return false;
        }

        // 排除时间选择器 - 默认使用 date 渲染器 
        if (isDatePickerElement(formItem)) {
          return false;
        }
        
        // 排除下拉树 - 默认使用 selectTree 渲染器 
        if (isSelectTreeElement(formItem)) {
          return false;
        }

        return true; 
      },
      /**
       * 执行 input 渲染逻辑
       * 
       * 对匹配的输入框元素进行初始化，建立与表单代理 (formProxy) 的双向数据绑定，
       * 并处理相关的用户交互、特殊属性和表单提交逻辑。
       * 
       * @function
       * @param {Object} item - 渲染项配置
       * @param {HTMLElement} formItem - 表单 DOM 元素
       * @param {*} formProxy - formplus 实例
       * 
       * @description
       * 主要执行流程：
       * 1.  **数据初始化**：将输入框的初始 `value` 同步到 `formProxy` 的数据模型中。
       * 2.  **事件绑定**：
       *     - 根据是否存在 `layui-lazy` 属性，决定监听 `input propertychange`（实时）或 `blur`（失焦）事件。
       *     - 将用户输入的值实时同步回 `formProxy`。
       * 3.  **功能增强**：
       *     - **字数限制**：如果输入框有 `maxlength` 属性，则调用 `handleMaxlength` 函数处理字数统计与限制。
       *     - **特殊修饰**：调用 `handleAffix` 函数处理可能存在的前缀/后缀（affix）等特殊 UI 行为。
       * 4.  **提交拦截 (`beforeExecute`)**：
       *     - 在表单提交前，将 `formProxy` 中的最新值写回 DOM 的 `value` 属性，确保最终值正确。
       *     - 触发关联的 `lay-event` 事件。
       * 5.  **同步事件**：普通输入框无需额外 `onSyncValue`，因为总能监听到input的变化。。
       */
      function (item, formItem, formProxy){

        var $formItem = $(formItem);

        /**
         * 获取表单元素上面的 lay-filter 属性值，用于事件绑定和 `beforeExecute` 监听
         */
        var formFilter = getFilterNameOfFormItem.call(formProxy, formItem);
        /**
         * 初始化数据：将输入框的初始值同步到 formProxy
         */
        formProxy.setData(formItem.name, formItem.value);

        // 定义事件
        var eventKey = formItem.getAttribute(component.CONST.LAYUI_LAZY) != null ? "blur" : "input propertychange";
        // 绑定输入框 change 事件
        layui.each(eventKey.split(" "), (k, v) => {
          formItem.addEventListener(v, function(){
            formProxy.setData(formItem.name, this.value);
          })
        })

        // 文本域字数限制
        // 首先判断这个文本域是否带有 属性 maxlength 这样可以限制它的输入字数
        if(formItem.hasAttribute("maxlength")){
          // lay-affix="number" input的结构会发生改变,先定向渲染它,然后再进行事件绑定
          if(formItem.getAttribute("lay-affix") == "number"){
            formRender.call(layui.form, $formItem);
          }
          // 调用方法处理 maxlength
          // 调用函数处理字数限制逻辑
          handleMaxlength(formItem, formProxy, formFilter);
        }

        // 特殊处理 affix 行为
        handleAffix(formItem, formProxy, formFilter);

        // 添加监视事件
        formProxy.beforeExecute(formFilter, function(evt){
          // input 框 做入参校验，接收所有
          formItem.value = evt.value;
          // 执行 lay-event 事件
          var eventKey = formItem.getAttribute("lay-event");
          if(eventKey) {
            invokeLayEvent(formProxy, eventKey, evt);
          }
        });

        // 添加同步事件，输入框无需事件绑定自动同步
      }
    ),
    /**
     * 下拉树 (SelectTree) 渲染器
     *
     * 用于识别并初始化自定义的下拉树形选择组件。
     * 该渲染器将一个隐藏的 input 元素转换为可视化的下拉树选择器，
     * 管理树形数据的展示、用户交互、值的同步与提交拦截。
     * 支持单选和复选模式，并通过自定义属性进行配置。
     *
     * @type {Renderer}
     *
     * @property {Function} match - 用于判断当前表单元素是否应由该渲染器处理的匹配函数。
     * @property {Function} render - 执行具体渲染逻辑的函数。
     */
    selectTree: new Renderer(
      /**
       * 判断是否适用 selectTree 渲染器
       * 
       * @param {HTMLElement} formItem - 表单元素
       * @param {string} formType - 表单类型
       * @param {string} type - 组件类型
       * @returns {boolean} 是否匹配
       * 
       * @description
       * 匹配规则：
       * 1. 必须是 input 元素
       * 2. 排除时间选择器（date 类型）
       * 3. 由 isSelectTreeElement 判断是否为下拉树标记元素
       */
      function (formItem, formType, type){

        // 类型必须是 input
        if (type && type != 'input') {
          return false;
        }
        // 排除时间选择器 - 默认使用 date 渲染器 
        if (isDatePickerElement(formItem)) {
          return false;
        }
      
        // 判断下拉树 
        return isSelectTreeElement(formItem);  
      }, 
      /**
       * 执行 selectTree 渲染逻辑
       * 
       * @param {Object} item - 渲染项配置
       * @param {HTMLElement} formItem - 表单 DOM 元素
       * @param {*} formProxy - formplus 实例
       * 
       * @description
       * 主要执行流程：
       * 1.  **UI 结构构建**：
       *     - 隐藏原始 input（用于存储值，如 ID）。
       *     - 创建一个新的 input（用于展示名称）和下拉箭头。
       *     - 创建下拉面板 (`<dl>`) 容器。
       * 2.  **数据初始化**：
       *     - 根据配置（`showCheckbox`）决定是初始化为数组（复选）还是字符串（单选）。
       *     - 使用转换器 (`converter`) 处理初始值。
       * 3.  **事件绑定**：
       *     - 监听原始 input 的 `input`/`propertychange`/`blur` 事件，用于响应外部 JavaScript 赋值。
       *     - 绑定父容器点击事件，用于展开/收起下拉树。
       *     - 阻止下拉面板的点击冒泡，防止意外关闭。
       * 4.  **树组件渲染**：
       *     - 调用 `renderTreeComponent` 函数在 `<dd>` 内渲染 Layui tree 实例。
       *     - 缓存树实例，便于后续操作（搜索、选中）。
       * 5.  **提交拦截 (`beforeExecute`)**：
       *     - 在表单提交或数据同步前，调用 `doFixValue` 校验并修正值。
       *     - 如果校验失败，阻止提交流程。
       *     - 触发关联的 `lay-event` 事件。
       * 6.  **同步事件**：下拉树组件无需额外的 `onSyncValue`，因为总能监听到input的变化。
       */
      function (item, formItem, formProxy){
        var $input = $(formItem);
        var $parent = $input.parent();
        var $root = $parent.parent();

        /**
         * 获取 lay-filter 属性值，用于事件命名空间
         */
        var filter = getFilterNameOfFormItem.call(formProxy, formItem);
        
        /**
         * 获取配置项
         */
        var attributeOptions = getElementAttributeOption(formItem);
        
        /**
         * 合并配置项
         */
        var options = deepMergeByTemplate(component.CONST.LAYUI_SELECT_TREE_OPTIONS, attributeOptions);
        
        /**
         * 初始化数据
         */
        if(options.showCheckbox === true){
          // 启用复选模式 ：初始化为空数组
          var value = [];
          if(formItem.value){
            var converterInst = formProxy.findConverter(layui.type(formItem.value), 'array', formItem.name);
            if (converterInst instanceof converter) {
              value = converterInst.convert.call(formProxy, formItem.value);
            }
          }
          formProxy.setData(formItem.name, value);
        } else {
          // 单选模式
          formProxy.setData(formItem.name, formItem.value);
        }
        // 定义事件
        var eventKey = formItem.hasAttribute(component.CONST.LAYUI_LAZY) ? "blur" : "input propertychange";
        // 绑定事件
        layui.each(eventKey.split(" "), (k, eventName) => {
          formItem.addEventListener(eventName, function(){
            var value = this.value;
            var converterInst = formProxy.findConverter(layui.type(value), layui.type(formProxy.getData(formItem.name)), formItem.name);
            var data = converterInst instanceof converter ? converterInst.convert.call(formProxy, value) : (options.showCheckbox === true ? [] : '');
            formProxy.setData(formItem.name, data);
          })
        });

        // 隐藏当前的input表单元素,这个元素记录的应该是类似id的信息，前端展示的是名称信息,这两个是分开的dom
        // 区分当前保存值的class
        $input.addClass(component.CONST.CLASS_HIDE).addClass(component.CONST.CLASS_SELECT_TREE_VALUE);
        // 创建一个 * + name 的输入框,作为后面展示的输入框,单独将它拎出来方便后面绑定事件
        var placeholder = $input.attr('placeholder') || '';
        var $nameDom = $(`<input type = "text" autocomplete="off" class="layui-input layui-unselect layui-input-name ${component.CONST.CLASS_SELECT_TREE_TITLE}"  name = "*${formItem.name}"  placeholder = "${placeholder}">`);
        // 加入DOM树中和下拉箭头
        $parent.append($nameDom).append('<i class="layui-edge"></i>');
        // 这里都是js赋值,不会触发input propertychange事件,为了方便就去掉这个，不对 $nameDom 绑定事件了
        // LAYUI_TREE_ID
        /**
         * 绑定事件 - 点击表单弹出下拉区域
         */
        $parent.on('click', function(e){
          // 点击parent节点调用方法展开树
          onClickTreeInput(e, $input, formProxy, formItem, $root);
          // 将input框上面的信息赋给tree
          // 获取tree的id
          var treeId = $root.find(`[${component.CONST.LAYUI_TREE_ID}]`).attr(component.CONST.LAYUI_TREE_ID);
          // 刷新树实例 
          var treeInst = formProxy.cacheTree(treeId);
          if (!treeInst) return;

          // 获取当前的值
          var treeValue = formProxy.getData(formItem.name);

          // 执行搜索与选中
          treeInst.search(null, treeValue);
          selectedOption(treeInst, treeValue);
        });

        /**
         * 新增，对$nameDom 绑定事件
         */
        if(options.showCheckbox === true && options.clearOnFocus === true){
          $nameDom.on('focus', function(){
            this.value = '';
          });
        }

        // dl dd节点模拟select下拉节点（dl > dd）
        var $dlDom = $('<dl class="layui-anim layui-anim-upbit" ></dl>');
        var $ddDom = $('<dd ></dd>');
        $dlDom.append($ddDom);
        $root.append($dlDom);

        // 阻止下拉区域点击冒泡，避免触发外部逻辑
        $dlDom.on('click',function(e){
          layui.stope(e);
        });

        // 渲染树组件（核心）
        renderTreeComponent($ddDom, options, $root, $input, $nameDom, formProxy, filter, formItem);

        // 添加监视事件
        formProxy.beforeExecute(filter, function(evt){
          // doFixValue 里面顺便校验参数 evt.value
          if(!doFixValue($root, formItem, formProxy, evt.value)){
            return false; // 阻止提交
          };

          var eventKey = formItem.getAttribute("lay-event");
          if(eventKey) {
            invokeLayEvent(formProxy, eventKey, evt);
          }
        });
        // 添加同步事件：输入框值已通过事件绑定自动同步，无需额外处理
      }
    ),
    /**
     * 日期时间选择器渲染器
     *
     * 用于识别并初始化符合条件的表单元素为 Layui layDate 组件。
     * 支持标准日期选择和带有农历增强功能的特殊主题。
     *
     * @type {Renderer}
     *
     * @property {Function} match - 用于判断当前表单元素是否应由该渲染器处理的匹配函数。
     * @property {Function} render - 执行具体渲染逻辑的函数。
     */
    date: new Renderer(
      /**
       * 判断是否适用 date 渲染器
       * 
       * @param {HTMLElement} formItem - 当前被检查的表单 DOM 元素。
       * @param {string} formType - 表单类型
       * @param {string} type - 组件类型
       * @returns {boolean} 是否匹配
       * 
       * @description
       * 匹配规则：
       * 1. 必须是 input 元素
       * 2. 是时间选择器（date 类型）
       */
      function (formItem, formType, type) {
        // 类型必须是 input
        if (type && type != 'input') {
          return false;
        }

        // 返回是否是时间选择器
        return isDatePickerElement(formItem);
      },
      /**
       * 执行 date 渲染逻辑
       * 
       * 对匹配的表单元素进行 layDate 组件的初始化和事件绑定。
       * 如果元素尚未被渲染，则根据其 `lay-options` 属性创建配置并渲染。
       * 如果已渲染，则获取其实例并扩展其行为。
       * 特别地，如果配置了 'lunar' 主题，则会应用农历增强功能。
       * 
       * @param {Object} item - 渲染项配置
       * @param {HTMLElement} formItem - 表单 DOM 元素
       * @param {*} formProxy - formplus 实例，用于与表单数据模型进行交互（如 `setData`, `getData`）和事件分发。
       * 
       * @description
       * 主要执行流程：
       * 1.  **检查渲染状态**：通过检查 `component.CONST.LAYUI_ALREADY_DATE_1` 和 `component.CONST.LAYUI_ALREADY_DATE_2` 这两个属性来判断该元素是否已被 layDate 渲染过。
       * 2.  **初始化配置**：如果未渲染，则解析 `lay-options` 属性（尝试将其从字符串解析为 JSON 对象）以获取 layDate 的初始配置选项。捕获解析错误并发出警告。
       * 3.  **应用特殊主题**：如果 `window.Lunar` 对象存在且配置中的 `theme` 为 `'lunar'`，则调用 {@link prepareLunarOption(options)} 函数对配置进行增强，注入农历相关的渲染和事件逻辑。
       * 4.  **渲染组件**：调用 `layui.laydate.render(options)` 完成 layDate 组件的初始化。
       * 5.  **获取实例**：通过读取 `component.CONST.LAYUI_ALREADY_DATE_2` 或 `component.CONST.LAYUI_ALREADY_DATE_1` 属性的值，作为 key 调用 `layui.laydate.getInst(key)` 获取 layDate 实例对象。
       * 6.  **拦截并扩展 `done` 回调**：
       *     - 保存原始的 `done` 回调函数。
       *     - 创建一个新的 `done` 回调 (`newDone`)，它在调用原始回调后，执行以下操作：
       *         - 调用 `formProxy.setData(formItem.name, value)` 将选中的日期值同步到表单代理的数据模型中。
       *         - 更新 `laydateInstance.config.value`，确保组件内部配置的值也保持最新，保证 `getValue` 等方法的一致性。
       *     - 将实例的 `config.done` 指向这个新的回调函数。
       * 7.  **初始化数据**：调用 `formProxy.setData(formItem.name, formItem.value)` 确保表单代理的初始数据与 input 元素的当前值一致。
       * 8.  **绑定前置执行事件**：通过 `formProxy.beforeExecute(formFilter, ...)` 监听表单提交或特定操作前的事件。在事件触发时：
       *     - 将 `formItem.value` 更新为事件参数中的新值。
       *     - 如果元素存在 `lay-event` 属性，则调用 `formProxy.invokeServiceLocator` 触发相应的服务或操作。
       */
      function (item, formItem, formProxy) {

        var $formItem = $(formItem);

        // 判断当前的表单元素是否已经被提前渲染
        // 更正属性值 layui-laydate-id => lay-laydate-id
        var notRendered = !formItem.hasAttribute(component.CONST.LAYUI_ALREADY_DATE_1) && !formItem.hasAttribute(component.CONST.LAYUI_ALREADY_DATE_2);

        if(notRendered){
          // 还没有渲染 laydate ，按照要求渲染
          // var optionsAttr = formItem.getAttribute("lay-options");
          var optionsAttr = formItem.getAttribute(component.CONST.LAYUI_OPTIONS);
          let options = {};
          if (optionsAttr) {
            try {
              options = JSON.parse(optionsAttr.replace(/\'/g, () => '"'));
            } catch (e) {
              console.warn('lay-options 解析失败:', optionsAttr, e);
            }
          }
          options.elem = formItem;
          /**
           * 新增 lunar 插件特殊处理
           * 参考地址 https://layui.dev/docs/2/laydate/#demo-custom-cell
           */
          if(window.Lunar && options.theme && options.theme == "lunar"){
            options = prepareLunarOption(options);
          }
          layui.laydate.render(options);
        }
        // 获取标识 key
        var laydateKey =
          formItem.getAttribute(component.CONST.LAYUI_ALREADY_DATE_2) ||
          formItem.getAttribute(component.CONST.LAYUI_ALREADY_DATE_1); // 更正属性值 layui-laydate-id => lay-laydate-id

        // 获取laydate对象
        var laydateInstance = layui.laydate.getInst(laydateKey);

        /**
         * 修改它的done回调，使值发生改变时修改对应的属性值
         */
        var done = laydateInstance.config.done;
        var newDone = function (value, date, endDate, p) {
          if (p) value = p.value;
          let params = {
            value: value,
            date: date,
            endDate: endDate,
          };
          // 但是保留自定义done函数 (新增的修改让done的this指向正确,可以直接调用cellRender来进行渲染)
          done && done.call(laydateInstance.config, value, date, endDate, params);
          formProxy.setData(formItem.name, params.value);
          // 对config.value进行修改值，让配置项里面获取到的值也正确
          laydateInstance.config.value = params.value;
        };
        laydateInstance.config.done = newDone;

        // 初始化数据
        formProxy.setData(formItem.name, formItem.value);

        var formFilter = getFilterNameOfFormItem.call(formProxy, formItem);

        // 添加监视事件
        formProxy.beforeExecute(formFilter, function(evt){
          // 参数不做校验，乱填就算了
          formItem.value = evt.value;
          var eventKey = formItem.getAttribute("lay-event");
          if(eventKey) {
            invokeLayEvent(formProxy, eventKey, evt);
          }
        });
        // 添加同步事件，输入框无需
      }
    ),
    /**
     * 复选框 (Checkbox) 渲染器
     *
     * 用于识别并初始化一组具有相同 `name` 属性的复选框元素。
     * 该渲染器负责管理复选框组的选中状态与表单数据模型之间的双向同步，
     * 并处理相关的用户交互事件和表单提交前的校验与更新。
     * 它专门处理皮肤类型非 'switch' 的复选框（即标准复选框样式）。
     *
     * @type {Renderer}
     *
     * @property {Function} match - 用于判断当前表单元素是否应由该渲染器处理的匹配函数。
     * @property {Function} render - 执行具体渲染逻辑的函数。
     */
    checkbox: new Renderer(
      /**
       * 判断是否适用 checkbox 渲染器
       *
       * 此函数检查给定的表单元素是否为一个标准的 Layui 复选框（非开关样式）。
       *
       * @function match
       * @param {HTMLElement} formItem - 当前被检查的表单 DOM 元素。
       * @param {string} [formType] - 表单元素的类型（在此匹配器中未使用，但为接口保留）。
       * @param {string} [type] - 元素的标签类型（例如 'checkbox', 'radio'）。
       * @returns {boolean} 如果 `type` 为 `"checkbox"` 且元素的 `lay-skin` 属性不等于 `"switch"`，则返回 `true`；否则返回 `false`。
       *
       * @description
       * 匹配规则如下：
       * 1.  **元素类型检查**：确认 `type` 参数的值为 `"checkbox"`。
       * 2.  **皮肤样式排除**：检查元素的 `lay-skin` 属性。如果该属性存在且其值为 `"switch"`，则认为这是一个开关（switch）组件，应由其他渲染器处理，因此返回 `false`。
       *    这确保了该渲染器仅处理具有标准复选框外观的元素。
       */
      function (formItem, formType, type) {
        return type == "checkbox" && formItem.getAttribute("lay-skin") != "switch";  
      }, 
      /**
       * 执行 checkbox 渲染逻辑
       *
       * 对匹配的复选框组进行初始化，建立与表单代理 (formProxy) 的双向数据绑定，
       * 并设置必要的事件监听器以响应用户操作和表单生命周期事件。
       * 优化点：缓存 DOM 查询结果、减少不必要的数组操作、增强错误处理。
       *
       * @function render
       * @param {Object} item - 当前渲染项的配置对象（通常包含该组复选框的容器信息）。
       * @param {HTMLElement} formItem - 组内任意一个复选框元素，用作参考以查找同组的其他元素。
       * @param {Object} formProxy - 表单代理实例，用于与表单数据模型进行交互（`setData`, `getData`）、事件分发和生命周期管理。
       *
       * @description
       * 主要执行流程：
       * 1.  **初始化数据**：
       *     - 缓存 `querySelectorAll` 结果，避免重复查询。
       *     - 遍历缓存的复选框节点列表，收集初始选中值和所有选项值。
       *     - 初始化表单代理数据。
       * 2.  **绑定 Layui 表单事件**：
       *     - 使用缓存的 `formFilter` 监听选中变化。
       *     - 复用初始化时缓存的节点列表（如果范围不变），或使用 `formItem.parentElement` 确保范围正确。
       * 3.  **绑定前置执行事件 (`beforeExecute`)**：
       *     - **性能**：使用 `Set` 结构存储 `eleValues`，将 `O(n)` 的 `indexOf` 查找优化为 `O(1)` 的 `has` 检查。
       *     - **健壮性**：添加 `try...catch` 包裹 DOM 操作，防止个别元素异常导致整个流程中断。
       *     - **性能**：在 `forEach` 中直接操作，避免创建临时数组。
       *     - **健壮性**：检查 `eventKey` 是否已存在，避免重复获取。
       * 4.  **绑定同步事件 (`onSyncValue`)**：实现从 DOM 向 Model 的最终状态同步（取值时）。
       */
      function (item, formItem, formProxy) {

        /**
         * 构建用于选择复选框组内所有复选框的 CSS 选择器
         */
        var checkboxGroupSelector = `[name="${formItem.name}"]`;
    
        /**
         * 初始化数据
         * 读取 DOM 的初始状态，设置到 formProxy，并建立选项值缓存。
         */
        var checkboxValues = [];

        /**
         * 缓存选项数据: 将 checkbox 各项缓存，以便在设置表单值时可以对比是否是一个合法的值
         * 使用 Set 存储所有选项的值，用于 O(1) 时间复杂度的快速查找，提升校验性能
         */
        var eleValuesSet = new Set(); 

        // 遍历所有复选框，收集选中值并构建选项缓存
        item.querySelectorAll(checkboxGroupSelector).forEach((checkbox) => {
          var value = checkbox.value;
          if (checkbox.checked) {
            checkboxValues.push(value);
          }
          // 将每个选项的值加入缓存
          eleValuesSet.add(value); 
        });

        // 将初始值设置到 formProxy 的模型中
        formProxy.setData(formItem.name, checkboxValues);

        /**
         * 获取当前表单项的 Layui 过滤器名称，用于事件绑定
         */
        var formFilter = getFilterNameOfFormItem.call(formProxy, formItem);

        // --- 绑定 Layui 表单事件 ---
        /**
         * 监听复选框的点击/状态改变事件
         */
        layui.form.on(
          `checkbox(${formFilter})`,
          function () {
            var newValues = [];
            // 重新读取所有复选框的当前状态
            item.querySelectorAll(checkboxGroupSelector).forEach((checkbox) => {
              if (checkbox.checked) {
                newValues.push(checkbox.value);
              }
            });
            // 将最新的选中值同步到 formProxy 模型
            formProxy.setData(formItem.name, newValues);  
          }
        );

        /**
         * 添加监视事件: 在监视值真正修改之前触发 
         */
        formProxy.beforeExecute(formFilter, function(evt){
          /**
           * 缓存当前复选框的 DOM 集合，避免重复查询
           */
          var currentCheckboxes = item.querySelectorAll(checkboxGroupSelector);

          /**
           * 参数检验标志：true 表示所有值均合法;
           * 依次查看每个选项在不在范围内
           */
          var checkFlag = true;

          /**
           * 标记是否需要更新 eleValuesSet 缓存
           * （例如，DOM 树中的内容被人为的改变）
           */
          var needsCacheUpdate = false;

          try {
            // 遍历待校验的值列表 (evt.value)
            layui.each(evt.value, function(key, value){
              // 检查缓存
              if(!eleValuesSet.has(value)) {
                // 缓存未命中，进行“回源”检查：在当前 DOM 中查找该值是否存在
                var isValid = false;
                for (var i = 0; i < currentCheckboxes.length; i++) {
                  if (currentCheckboxes[i].value === value) {
                    isValid = true;
                    break; // 找到即跳出，无需遍历完
                  }
                }
                if (!isValid) {
                  // 值在 DOM 中也不存在，为非法值
                  checkFlag = false;
                  // 退出循环
                  return true;
                }
                // 值在 DOM 中找到，但不在缓存中，说明是新选项，需要更新缓存
                needsCacheUpdate = true;
              }
            });

            // 如果发现需要更新缓存
            if(needsCacheUpdate) {
              eleValuesSet.clear(); // 清空现有缓存
              // 重建缓存，包含当前 DOM 中的所有选项值
              currentCheckboxes.forEach(cb => eleValuesSet.add(cb.value));
            }

            // 如果存在非法值，阻止后续执行
            if(!checkFlag) {
              // 这里return 值 === false 赋值操作将会被打断，值进行回滚
              return false;
            }  

            /**
             * DOM 上标记需要触发的函数名称
             */
            var eventKey = "";

            // 遍历处理，确保 DOM 状态与 evt.value 一致
            currentCheckboxes.forEach((checkbox) => {
              var isChecked = evt.value.includes(checkbox.value);
              // 仅当状态不一致时才更新 DOM 和属性
              if (checkbox.checked !== isChecked) {
                checkbox.checked = isChecked;
                if (isChecked) {
                  checkbox.setAttribute("checked", "checked");
                } else {
                  checkbox.removeAttribute("checked");
                }
              }

              // 如果复选框有 lay-event 属性
              if(!eventKey){
                eventKey = checkbox.getAttribute("lay-event");
              }
            });
          } catch (error) {
            console.warn('复选框值校验时发生错误:', error);
            return false;
          }

          // 重新渲染表单元素
          try {
            layui.form.render(
              "checkbox",
              item.getAttribute(component.CONST.LAYUI_FILTER)
            );
          } catch (error) {
            console.error('Layui 复选框重渲染失败:', error);
          }

          // 触发关联的服务或操作
          if(eventKey) {
            invokeLayEvent(formProxy, eventKey, evt);
          }

        });

        // 添加同步事件
        // 当需要从页面获取复选框组的值时触发（例如表单提交前取值）
        formProxy.onSyncValue(formItem.name, function(){
          /**
           * 用于存储从 DOM 读取的最新选中值
           */
          var checkboxValues = [];
          /**
           * 从 formProxy 模型中读取当前值
           */
          var nowValues = formProxy.getData(formItem.name);
          /**
           * 将模型值转为 Set，用于 O(1) 时间复杂度的一致性检查
           */
          var nowValuesSet = new Set(nowValues);
          /**
           * 标记 DOM 状态与模型数据是否一致
           * 假设初始状态一致
           */
          var isConsistent = true; 
          // 缓存 DOM 查询
          var currentCheckboxes = item.querySelectorAll(checkboxGroupSelector);

          try{
            // 遍历所有复选框，读取状态并检查一致性
            currentCheckboxes.forEach((checkbox) => {
              var isChecked = checkbox.checked;
              var value = checkbox.value;

              // 收集选中的值
              if (isChecked) {
                checkboxValues.push(value);
              }

              // 检查 DOM 的 checked 状态是否与模型中的存在性一致
              var inModel = nowValuesSet.has(value);
              if (isChecked !== inModel) {
                // 只要有一个不一致，整体就不一致
                isConsistent = false;
              }
            });
          } catch (error) {
            console.error('onSyncValue: 查询复选框状态时发生错误:', error);
          }
          // 如果 DOM 与模型状态不一致，则进行同步
          if(!isConsistent){
            // 将从 DOM 读取的最新值同步到 formProxy 模型
            formProxy.setData(formItem.name, checkboxValues);
            // 同时，更新本地的选项值缓存 (eleValuesSet)，以反映可能的 DOM 变化
            eleValuesSet.clear(); 
            currentCheckboxes.forEach(cb => eleValuesSet.add(cb.value));
          }  
        });
      }
    ),
    /**
     * 单选框 (Radio) 渲染器
     *
     * 用于识别并初始化一组具有相同 `name` 属性的单选框元素。
     * 该渲染器负责管理单选框组的选中状态与表单数据模型之间的双向同步，
     * 并处理相关的用户交互事件和表单提交前的校验与更新。
     *
     * @type {Renderer}
     *
     * @property {Function} match - 用于判断当前表单元素是否应由该渲染器处理的匹配函数。
     * @property {Function} render - 执行具体渲染逻辑的函数。
     */
    radio: new Renderer(
      /**
       * 判断是否适用 radio 渲染器
       *
       * 此函数检查给定的表单元素是否为一个单选框。
       *
       * @function match
       * @param {HTMLElement} formItem - 当前被检查的表单 DOM 元素。
       * @param {string} [formType] - 表单元素的类型（在此匹配器中未使用，但为接口保留）。
       * @param {string} [type] - 元素的标签类型（例如 'checkbox', 'radio'）。
       * @returns {boolean} 如果 `type` 为 `"radio"`，则返回 `true`；否则返回 `false`。
       */
      function (formItem, formType, type) {
        return type == "radio";  
      }, 
      /**
       * 执行 radio 渲染逻辑
       *
       * 对匹配的单选框组进行初始化，建立与表单代理 (formProxy) 的双向数据绑定，
       * 并设置必要的事件监听器以响应用户操作和表单生命周期事件。
       * 优化点：使用 Set 优化校验性能，缓存 DOM 查询，增强错误处理。
       *
       * @function render
       * @param {Object} item - 当前渲染项的配置对象（通常包含该组单选框的容器信息）。
       * @param {HTMLElement} formItem - 组内任意一个单选框元素，用作参考以查找同组的其他元素。
       * @param {Object} formProxy - 表单代理实例，用于与表单数据模型进行交互（`setData`, `getData`）、事件分发和生命周期管理。
       *
       * @description
       * 主要执行流程：
       * 1.  **初始化数据**：
       *     - 遍历同名单选框，读取初始选中值和所有选项值。
       *     - 使用 Set (`eleValuesSet`) 存储选项值以优化后续校验。
       *     - 初始化表单代理数据。
       * 2.  **绑定 Layui 表单事件**：
       *     - 监听单选框的点击/状态改变事件。
       *     - 更新 formProxy 中的值。
       * 3.  **绑定前置执行事件 (`beforeExecute`)**：
       *     - **性能**：使用 `Set` (`eleValuesSet`) 进行 `O(1)` 时间复杂度的值校验。
       *     - **健壮性**：添加 `try...catch` 包裹核心操作。
       *     - **一致性**：根据传入的 `evt.value` 同步 DOM 状态。
       * 4.  **绑定同步事件 (`onSyncValue`)**：实现从 DOM 向 Model 的最终状态同步（取值时）。
       */
      function (item, formItem, formProxy) {
        /**
         * 构建用于选择单选框组内所有单选框的 CSS 选择器
         */
        var radioGroupSelector = `[name="${formItem.name}"]`;
        /**
         * 初始化数据
         * 读取 DOM 的初始状态，设置到 formProxy，并建立选项值缓存。
         */
        var radioValue = "";
        /**
         * 缓存选项数据: 使用 Set 存储所有选项的值，用于 O(1) 时间复杂度的快速查找，提升校验性能
         */
        var eleValuesSet = new Set();

        // 遍历所有单选框，收集选中值和所有选项值
        item.querySelectorAll(radioGroupSelector).forEach((radio) => {
          if (radio.checked) {
            // 单选框只有一个选中
            radioValue = radio.value;
          } 
          // 将每个选项的值加入缓存
          eleValuesSet.add(radio.value); 
        });

        // 将初始值设置到 formProxy 的模型中
        formProxy.setData(formItem.name, radioValue);

        /**
         * 获取当前表单项的 Layui 过滤器名称，用于事件绑定
         */
        var formFilter = getFilterNameOfFormItem.call(formProxy, formItem);

        /**
         * 监听单选框的点击/状态改变事件
         */
        layui.form.on(
          `radio(${formFilter})`,
          function () {
            item.querySelectorAll(radioGroupSelector).forEach((radio) => {
              if (radio.checked){
                // 将最新的选中值同步到 formProxy 模型
                formProxy.setData(formItem.name, radio.value);
                return; // 找到即退出，无需遍历完
              }
            });
          }
        );

        /**
         * 添加监视事件: 在监视值真正修改之前触发 
         */
        formProxy.beforeExecute(formFilter, function(evt){
          /**
           * 缓存当前单选框的 DOM 集合，避免重复查询
           */
          var currentRadios = item.querySelectorAll(radioGroupSelector);

          /**
           * 参数检验标志：true 表示值合法
           */
          var checkFlag = true;

          /**
           * 标记是否需要更新 eleValuesSet 缓存
           * （例如，DOM 树中的内容被人为的改变）
           */
          var needsCacheUpdate = false;

          try{

            // 使用 Set 进行 O(1) 查找
            if (!eleValuesSet.has(evt.value)) {
              // 缓存未命中，进行“回源”检查：在当前 DOM 中查找该值是否存在
              var isValid = false;
              for (var i = 0; i < currentRadios.length; i++) {
                if (currentRadios[i].value === evt.value) {
                  isValid = true;
                  break; // 找到即跳出，无需遍历完
                }
              }
              if (!isValid) {
                // 值在 DOM 中也不存在，为非法值
                checkFlag = false;
              } else {
                // 值在 DOM 中找到，但不在缓存中，说明是新选项，需要更新缓存
                needsCacheUpdate = true;
              }
            }

            // 如果发现需要更新缓存
            if(needsCacheUpdate) {
              eleValuesSet.clear(); // 清空现有缓存
              // 重建缓存，包含当前 DOM 中的所有选项值
              currentRadios.forEach(cb => eleValuesSet.add(cb.value));
            }

            // 如果值不合法，阻止后续执行
            if (!checkFlag) {
              // 这里return 值 === false 赋值操作将会被打断，值进行回滚
              return false;
            }

            /**
             * DOM 上标记需要触发的函数名称
             */
            var eventKey = "";

            // 遍历处理，确保 DOM 状态与 evt.value 一致
            currentRadios.forEach((radio) => {
              var shouldCheck = (evt.value === radio.value);
              if (radio.checked !== shouldCheck) {
                radio.checked = shouldCheck;
                if (shouldCheck) {
                  radio.setAttribute("checked", "checked");
                } else {
                  radio.removeAttribute("checked");
                }
              }
              // 如果单选框有 lay-event 属性
              if (!eventKey) {
                eventKey = radio.getAttribute("lay-event");
              }
            });
          } catch (error) {
            console.warn('单选框值校验或状态同步时发生错误:', error);
            return false;
          }

          // 重新渲染表单
          try {
            layui.form.render(
              "radio",
              item.getAttribute(component.CONST.LAYUI_FILTER)
            );
          } catch (error) {
            console.error('Layui 单选框重渲染失败:', error);
          }

          // 触发关联的服务或操作
          if(eventKey) {
            invokeLayEvent(formProxy, eventKey, evt);
          }
        });

        // 添加同步事件
        // 当需要从页面获取单选框组的值时触发（例如表单提交前取值）
        formProxy.onSyncValue(formItem.name, function(){
          /**
           * 用于存储从 DOM 读取的最新选中值
           */
          var radioValue = "";
          /**
           * 从 formProxy 模型中读取当前值
           */
          var nowValue = formProxy.getData(formItem.name);
          /**
           * 标记 DOM 状态与模型数据是否一致
           */
          var isConsistent = true;
          /**
           * 缓存 DOM 查询
           */
          var currentRadios;

          try {
            currentRadios = item.querySelectorAll(radioGroupSelector);
            // 遍历所有单选框，读取状态并检查一致性
            currentRadios.forEach((radio) => {
              if (radio.checked) {
                radioValue = radio.value;
              }
            });
            // 检查一致性
            isConsistent = (radioValue === nowValue);

          } catch (error) {
            console.error('onSyncValue: 查询单选框状态时发生错误:', error);
            // 发生错误时，假设不一致，触发更新以确保数据正确性
            isConsistent = false;
          }

          // 如果 DOM 与模型状态不一致，则进行同步
          if (!isConsistent) {
            // 将从 DOM 读取的最新值同步到 formProxy 模型
            formProxy.setData(formItem.name, radioValue);
            // 同时，更新本地的选项值缓存 (eleValuesSet)，以反映可能的 DOM 变化
            eleValuesSet.clear(); 
            currentRadios.forEach(cb => eleValuesSet.add(cb.value));
          }  

        });

      }
    ),
    /**
     * 下拉选择框 (Select) 渲染器
     *
     * 用于识别并初始化 HTML <select> 元素。
     * 该渲染器负责管理下拉框的选中值与表单数据模型之间的双向同步，
     * 确保数据一致性。它提供了高性能的值校验机制（通过 Set 缓存），
     * 增强了错误处理能力，并能适应动态添加或移除选项的场景。
     *
     * @type {Renderer}
     *
     * @property {Function} match - 用于判断当前表单元素是否应由该渲染器处理的匹配函数。
     *                             通过检查元素的 type 属性是否为 "select" 来进行匹配。
     * @property {Function} render - 执行具体渲染逻辑的函数，负责初始化、事件绑定、数据同步等。
     */
    select: new Renderer(
      /**
       * 判断是否适用 Select 渲染器
       *
       * 此函数检查给定的表单元素是否为下拉选择框。
       *
       * @function match
       * @param {HTMLElement} formItem - 当前被检查的表单 DOM 元素。
       * @param {string} [formType] - 表单元素的类型（在此匹配器中未使用，但为接口保留）。
       * @param {string} [type] - 元素的标签类型（例如 'checkbox', 'radio'）。
       * @returns {boolean} 如果 `type` 为 `"select"`，则返回 `true`；否则返回 `false`。
       */
      function (formItem, formType, type) {
        return type == "select";  
      },
      /**
       * 执行 select 渲染逻辑
       *
       * 对匹配的下拉选择框 (select) 进行初始化，建立与表单代理 (formProxy) 的双向数据绑定，
       * 并设置必要的事件监听器以响应用户操作和表单生命周期事件。
       * 优化点：使用 Set 优化校验性能，缓存 DOM 查询，增强错误处理，支持动态选项更新。
       *
       * @function render
       * @param {Object} item - 当前渲染项的配置对象（通常包含该 select 元素的容器信息）。
       * @param {HTMLElement} formItem - select 元素本身。
       * @param {Object} formProxy - 表单代理实例，用于与表单数据模型进行交互（`setData`, `getData`）、事件分发和生命周期管理。
       *
       * @description
       * 主要执行流程：
       * 1.  **初始化数据**：
       *     - 遍历所有 option，读取初始选中值和所有选项值。
       *     - 使用 Set (`optionValuesSet`) 存储选项值以优化后续校验 (O(1) 时间复杂度)。
       *     - 初始化表单代理数据。
       * 2.  **绑定 Layui 表单事件**：
       *     - 监听 select 的 change 事件。
       *     - 将用户在界面上的选择同步到 formProxy 的数据模型中。
       * 3.  **绑定前置执行事件 (`beforeExecute`)**：
       *     - **性能**：利用 `Set` (`optionValuesSet`) 进行高效值校验。
       *     - **健壮性**：核心操作包裹在 `try...catch` 中。
       *     - **一致性**：根据传入的 `evt.value` 同步 DOM 状态 (selected 属性)。
       *     - **动态适应**：检测到新选项时自动更新本地缓存。
       * 4.  **绑定同步事件 (`onSyncValue`)**：实现从 DOM 向 Model 的最终状态同步（取值时），并更新缓存。
       */
      function (item, formItem, formProxy) {
        /**
         * 构建用于选择下拉框内所有 option 的 CSS 选择器
         */
        var optionSelector = `option`;

        /**
         * 缓存选项数据: 使用 Set 存储所有 option 的 value，用于 O(1) 时间复杂度的快速查找
         * 这能显著提升后续值校验的性能，尤其在选项数量多时。
         */
        var optionValuesSet = new Set();

        /**
         * 1. 遍历所有 option 元素，读取其 value 属性，并加入到 optionValuesSet 缓存中。
         * 2. 将 DOM 元素的初始 value 值同步到 formProxy 的数据模型中。
         * 此过程使用 try-catch 包裹，确保初始化阶段的错误不会导致整个渲染流程中断。
         */
        try {
          // 一次性遍历，构建缓存
          formItem.querySelectorAll(optionSelector).forEach(option => {
            optionValuesSet.add(option.value);
          });
          // 将 DOM 的初始值设置到 formProxy 模型
          formProxy.setData(formItem.name, formItem.value);
        } catch (error) {
          console.error('Select 初始化失败:', error);
          // 即使初始化失败，也尝试设置一个基础值（空字符串或 DOM 当前值），避免后续完全失效
          formProxy.setData(formItem.name, formItem.value || "");
        }

        /**
         * 获取当前表单项的 Layui 过滤器名称，用于后续的事件绑定
         */
        var formFilter = getFilterNameOfFormItem.call(formProxy, formItem);

        /**
         * 监听 select 的 change 事件。当用户通过界面选择一个新选项时触发。
         * 该监听器的职责是将用户在界面上的选择同步到 formProxy 的数据模型中。
         */
        layui.form.on(
          `select(${formFilter})`,
          function () {
            // 直接从 DOM 读取当前选中的 value，并更新到数据模型
            formProxy.setData(formItem.name, formItem.value);
          }
        );

        /**
         * 添加监视事件: 在外部尝试修改 formProxy 模型中的值之前触发。
         * 这是确保数据一致性和进行值校验的关键环节。
         * 它负责：
         *  1. 校验新值 (evt.value) 是否存在于当前的 option 列表中。
         *  2. 如果值有效，则同步更新 DOM 状态 (selected 属性) 和 select 元素的 value。
         *  3. 重新渲染 Layui 表单以反映视觉变化。
         *  4. 触发绑定的 lay-event 事件。
         *  5. 如果值无效，则中断赋值操作 (return false)，保证模型数据的合法性。
         */
        formProxy.beforeExecute(formFilter, function(evt){
          /**
           * 缓存当前所有的 option DOM 集合，避免在循环中重复查询，提升性能。
           */
          var currentOptions;

          try {
            // 缓存 DOM 查询结果
            currentOptions = formItem.querySelectorAll(optionSelector);

            // 先在 Set 缓存中进行 O(1) 时间复杂度的快速查找
            if (!optionValuesSet.has(evt.value)) {
              // 缓存未命中，进行“回源”检查：在当前 DOM 的 option 列表中查找该值是否存在
              var isValidInDOM = false;
              for (var i = 0; i < currentOptions.length; i++) {
                if (currentOptions[i].value === evt.value) {
                  isValidInDOM = true;
                  break; // 找到即跳出，无需遍历完
                }
              }
              if (!isValidInDOM) {
                // 值在 DOM 中也不存在，为非法值
                // 这里return 值 === false 赋值操作将会被打断，值进行回滚
                return false;
              } else {
                // 值在 DOM 中找到，但不在缓存中，说明是新动态添加的选项，需要更新缓存
                optionValuesSet.clear(); // 清空旧缓存
                // 重建缓存，包含当前 DOM 中的所有 option 值
                currentOptions.forEach(option => optionValuesSet.add(option.value));
              }
            }

            // 遍历所有 option，根据 evt.value 更新其 selected 属性和 select 元素的 value
            // 性能提升：直接设置 DOM 元素的 JavaScript 属性 (Property) 比 原生设置属性值更高效
            currentOptions.forEach((option) => {
              option.selected = (evt.value === option.value); // 直接赋值，更简洁
            });

            // 设置表单值
            formItem.value = evt.value;

            // 重新渲染表单
            layui.form.render("select", item.getAttribute(component.CONST.LAYUI_FILTER));

          } catch (error) {
            console.warn('Select 值校验或状态同步时发生错误:', error);
            return false; // 捕获到错误，中断执行，保证数据模型稳定
          }

          // 在数据和 DOM 状态同步成功后，触发绑定的 lay-event 事件
          var eventKey = formItem.getAttribute("lay-event");
          if(eventKey) {
            invokeLayEvent(formProxy, eventKey, evt);
          }

        });

        // 添加同步事件
        formProxy.onSyncValue(formItem.name, function(){
          /**
           * 从 DOM 读取当前 select 元素的实际值
           */
          var domValue = formItem.value;
          /**
           * 从 formProxy 模型中读取当前值
           */
          var nowValue = formProxy.getData(formItem.name);
          // 如果不同步就重新赋值 
          if(domValue != nowValue) {
            try {
              // 将从 DOM 读取的最新值同步到 formProxy 模型
              formProxy.setData(formItem.name, domValue);

              // 获取当前所有 option 元素
              var currentOptions = formItem.querySelectorAll(optionSelector);
              // 同时，更新本地的选项值缓存 (eleValuesSet)，以反映可能的 DOM 变化
              eleValuesSet.clear(); 
              if (currentOptions && currentOptions.length > 0) {
                currentOptions.forEach(option => optionValuesSet.add(option.value));
              }
            } catch (error) {
              console.error('onSyncValue: 同步下拉框值和缓存时发生错误:', error);
            }
          } 
            
        });

        // 添加提示
        let layHint = formItem.getAttribute("lay-hint");
        if(layHint != null) enableComplate(formItem, formProxy);

      }
    ),
    /**
     * 开关 (Switch) 渲染器
     *
     * 用于识别并初始化 Layui 开关（Switch）组件。
     * 该渲染器负责管理开关组件的布尔状态与表单数据模型之间的双向同步，
     * 并处理相关的用户交互事件和表单提交前的校验与更新。
     * 它专门处理皮肤类型为 'switch' 的复选框（即滑动开关样式）。
     *
     * @type {Renderer}
     *
     * @property {Function} match - 用于判断当前表单元素是否应由该渲染器处理的匹配函数。
     * @property {Function} render - 执行具体渲染逻辑的函数。
     */
    switch: new Renderer(
      /**
       * 判断是否适用 switch 渲染器
       *
       * 此函数检查给定的表单元素是否为一个 Layui 开关（Switch）组件。
       *
       * @function match
       * @param {HTMLElement} formItem - 当前被检查的表单 DOM 元素。
       * @param {string} [formType] - 表单元素的类型（在此匹配器中未使用，但为接口保留）。
       * @param {string} [type] - 元素的标签类型（例如 'checkbox', 'radio'）。
       * @returns {boolean} 如果 `type` 为 `"switch"` 且元素的 `lay-skin` 属性等于 `"switch"`，则返回 `true`；否则返回 `false`。
       *
       * @description
       * 匹配规则如下：
       * 1.  **元素类型检查**：确认 `type` 参数的值为 `"switch"`。
       * 2.  **皮肤样式确认**：检查元素的 `lay-skin` 属性。如果该属性存在且其值为 `"switch"`，则认为这是一个开关（switch）组件，应由本渲染器处理。
       *    这确保了该渲染器仅处理具有滑动开关外观的元素。
       */
      function(formItem, formType, type){
        return type == "switch" && formItem.getAttribute("lay-skin") == "switch";  
      }, 
      /**
       * 执行 switch 渲染逻辑
       *
       * 对匹配的开关组件进行初始化，建立与表单代理 (formProxy) 的双向数据绑定，
       * 并设置必要的事件监听器以响应用户操作和表单生命周期事件。
       * 优化点：缓存 DOM 查询结果、减少不必要的操作、增强错误处理与健壮性。
       *
       * @function render
       * @param {Object} item - 当前渲染项的配置对象（通常包含该开关的容器信息）。
       * @param {HTMLElement} formItem - 开关元素本身，用作参考以查找同名元素。
       * @param {Object} formProxy - 表单代理实例，用于与表单数据模型进行交互（`setData`, `getData`）、事件分发和生命周期管理。
       *
       * @description
       * 主要执行流程：
       * 1.  **初始化数据**：
       *     - 缓存 `querySelectorAll` 结果，避免重复查询。
       *     - 遍历缓存的开关节点列表，将初始 `checked` 状态同步到 `formProxy`。
       * 2.  **绑定 Layui 表单事件**：
       *     - 使用 `formFilter` 监听开关状态变化。
       *     - 将新的布尔值同步回 `formProxy`。
       * 3.  **绑定前置执行事件 (`beforeExecute`)**：
       *     - **健壮性**：使用 `try...catch` 包裹 DOM 操作，防止个别元素异常中断流程。
       *     - **性能**：缓存 `switchElements`，避免重复查询。
       *     - **效率**：仅在状态不一致时更新 DOM 和属性。
       *     - **事件触发**：获取 `lay-event` 并调用服务定位器。
       * 4.  **绑定同步事件 (`onSyncValue`)**：实现从 DOM 向 Model 的最终状态同步（取值时），确保数据一致性。
       */
      function(item, formItem, formProxy){

        /**
         * 构建用于选择复选框组内所有复选框的 CSS 选择器
         * 虽然通常只有一个，但按 name 属性查询以保持一致性
         */
        var switchGroupSelector = `[name="${formItem.name}"]`;
        /**
         * 初始化数据：将页面上开关的初始状态同步到 formProxy 的数据模型中
         */
        item
          .querySelectorAll(switchGroupSelector)
          .forEach((checkbox) => {
            // 将初始 checked 状态设置到 formProxy
            formProxy.setData(formItem.name, checkbox.checked);
          });

        /**
         * 获取当前表单项的 Layui 过滤器名称，用于事件绑定
         */
        var formFilter = getFilterNameOfFormItem.call(formProxy, formItem);

        // 定义事件
        /**
         * 监听switch的点击/状态改变事件
         */
        layui.form.on(
          `switch(${formFilter})`,
          function () {
            // 将新的开关状态同步到 formProxy
            formProxy.setData(formItem.name, this.checked);
          }
        );

        /**
         * 添加监视事件: 在监视值真正修改之前触发 
         * 用于响应外部数据更新（如表单回填、API 设置）
         */
        formProxy.beforeExecute(formFilter, function(evt){
          
          /**
           * DOM 上标记需要触发的函数名称
           */
          var eventKey = "";
          
          try{
            // switch 参数不用管，要么true, 要么false不能乱来
            item
              .querySelectorAll(switchGroupSelector)
              .forEach((checkbox) => {
                var isChecked = evt.value;
                // 仅当状态不一致时才更新 DOM 和属性
                if(checkbox.checked !== isChecked){
                  checkbox.checked = isChecked;
                  if (isChecked) {
                    checkbox.setAttribute("checked", "checked");
                  } else {
                    checkbox.removeAttribute("checked");
                  }
                }

                // 如果复选框有 lay-event 属性
                if(!eventKey){
                  eventKey = checkbox.getAttribute("lay-event");
                }
              
              });

          }catch (error) {
            console.warn('switch值校验时发生错误:', error);
            return false;
          }
          
          // 重新渲染表单元素
          try {
            layui.form.render(
              "checkbox",
              item.getAttribute(component.CONST.LAYUI_FILTER)
            );
          } catch (error) {
            console.error('Layui switch重渲染失败:', error);
          }
          
          // 如果定义了 lay-event，则触发对应的事件处理器
          if(eventKey) {
            invokeLayEvent(formProxy, eventKey, evt);
          }
        })

        // 添加同步事件
        // 当需要从页面获取复选框组的值时触发（例如表单提交前取值）
        formProxy.onSyncValue(formItem.name, function(){
          var nowValue = formProxy.getData(formItem.name);
          var switchValue = false;

          item
            .querySelectorAll(`[name="${formItem.name}"]`)
            .forEach((checkbox) => {
              switchValue = checkbox.checked;
            });

          // 如果不同步就重新赋值 
          if(switchValue != nowValue)  
            formProxy.setData(formItem.name, switchValue);
        });

      }
    ),
  }

  var formConverters = {
    string2string: new converter(function(I, O){
      return 'string' === I && 'string' === O;
    }, function(input){
      return input;
    }),
    number2string: new converter(function(I, O){
      return 'number' === I && 'string' === O;
    }, function(input){
      return String(input);
    }),
    boolean2string: new converter(function(I, O){
      return 'boolean' === I && 'string' === O;
    }, function(input){
      return input === true ? 'true' : 'false';
    }),
    array2string: new converter(function(I, O){
      return 'array' === I && 'string' === O;
    }, function(input){
      return input.join(',');
    }),
    object2string: new converter(function(I, O){
      return 'object' === I && 'string' === O;
    }, function(input){
      return String(input);
    }),
    undefined2string: new converter(function(I, O){
      return 'undefined' === I && 'string' === O;
    }, function(input){
      return "";
    }),

    boolean2boolean: new converter(function(I, O){
      return 'boolean' === I && 'boolean' === O;
    }, function(input){
      return input;
    }),
    string2boolean: new converter(function(I, O){
      return 'string' === I && 'boolean' === O;
    }, function(input){
      return 'false' === input ? false : !!input;
    }),
    number2boolean: new converter(function(I, O){
      return 'number' === I && 'boolean' === O;
    }, function(input){
      return 0 !== input;
    }),
    array2boolean: new converter(function(I, O){
      return 'array' === I && 'boolean' === O;
    }, function(input){
      return input.length > 0;
    }),
    object2boolean: new converter(function(I, O){
      return 'object' === I && 'boolean' === O;
    }, function(input){
      return !!input;
    }),
    undefined2boolean: new converter(function(I, O){
      return 'undefined' === I && 'boolean' === O;
    }, function(input){
      return false;
    }),


    array2array: new converter(function(I, O){
      return 'array' === I && 'array' === O;
    }, function(input){
      return input.map(String);
    }),
    string2array: new converter(function(I, O){
      return 'string' === I && 'array' === O;
    }, function(input){
      return input.split(',');
    }),
    boolean2array: new converter(function(I, O){
      return 'boolean' === I && 'array' === O;
    }, function(input){
      return [];
    }),
    number2array: new converter(function(I, O){
      return 'number' === I && 'array' === O;
    }, function(input){
      var total = Math.floor(Math.abs(input));
      return 0 == total ? [] : Array(total).fill("");
    }),
    object2array: new converter(function(I, O){
      return 'object' === I && 'array' === O;
    }, function(input){
      return [String(input)];
    }),
    undefined2array: new converter(function(I, O){
      return 'undefined' === I && 'array' === O;
    }, function(input){
      return [];
    }),

  }

  /**
   * @var
   * 全局计数
   * @type {Number}
   */
  var INTERNAL_INDEX = 0;

  /* 三、方法集合 */

  /**
   * @function getFilterNameOfForm
   * 获取/生成表单的 lay-filter 属性值
   * 
   * 为表单元素提供一个唯一的、可用于事件绑定的命名空间标识。
   * 如果元素已存在 `lay-filter` 属性，则返回其值；
   * 否则，生成一个唯一的临时标识并设置到元素上，避免重复生成。
   * 
   * @param {HTMLElement} item 表单最外层的 DOM 元素（必须）
   * @returns {String} 返回 `lay-filter` 的值。保证不为 null 或 undefined。
   * 
   * @throws {Error} 当传入的 item 不是有效的 HTMLElement 时抛出错误。
   */
  function getFilterNameOfForm(item){
    // 参数校验：确保传入的是有效的 DOM 元素
    if (!item || !(item instanceof HTMLElement)) {
      throw new Error('getFilterNameOfForm: 参数 "item" 必须是一个有效的 HTMLElement');
    }
    // 尝试获取元素的 lay-filter 属性值
    var filterValue = item.getAttribute(component.CONST.LAYUI_FILTER);

    // 没有获取到就自动生成一个值
    if(!filterValue) {
      filterValue = `layui-formplus-${INTERNAL_INDEX++}`;
      // 设置属性值
      item.setAttribute(component.CONST.LAYUI_FILTER, filter);
    }

    return filterValue;
  }

  /**
   * @function
   * 获取/生成表单元素的 lay-filter 属性值
   * 
   * @this component实例
   * @param {HTMLElement} formItem 表单元素
   * @returns {String} lay-filter 属性值
   */
  function getFilterNameOfFormItem(formItem){

    // 优化：使用 instanceof 进行更精确的类型检查
    if (!formItem || !(formItem instanceof HTMLElement)) {
      return null;
    }

    // 尝试获取表单元素的 lay-filter 属性值
    var filter = formItem.getAttribute(component.CONST.LAYUI_FILTER);

    // 没有获取到就自动生成一个值(表单的唯一id和表单元素的name属性进行拼接，这两个值必然存在的)
    if(!filter) {
      filter = `${this.config.id}-${formItem.name}`;
      // 设置属性值
      if(formItem.type == 'checkbox' ||formItem.type == 'radio') {
        this.config.elem.find(`[name="${escapeSelector(formItem.name)}"]`).attr(component.CONST.LAYUI_FILTER, filter);
      } else {
        formItem.setAttribute(component.CONST.LAYUI_FILTER, filter);
      }
    }

    return filter;
  }

  /**
   * @function
   * 从dom属性中获取配置项参数
   * 
   * @param {HTMLElement} formItem 表单元素
   * @param {String} attributeName 属性名称
   * @param {Object} defaultValue 缺省返回值
   * @returns {Object} 配置项参数
   */
  function getElementAttributeOption(formItem, attributeName = component.CONST.LAYUI_OPTIONS, defaultValue = {}){

    /**
     * 入参校验
     */
    if (!(formItem instanceof HTMLElement)) {
      console.warn("传入的 formItem 不是一个有效的 HTMLElement");
      return defaultValue;
    }

    var optionsAttr = formItem.getAttribute(attributeName);
    if (!optionsAttr) {
      /**
       * 属性不存在，返回空对象
       */
      return defaultValue; 
    } 
    try {
      /**
       * 属性值处理:
       * ┌───────────────────┐
       * │ 单引号替换成双引号   │
       * └──────┬────────────┘
       *        ↓
       * ┌─────────────────────────────┐
       * │ 处理转义错误（如果用户写了\"）  │
       * └──────┬──────────────────────┘
       *        ↓
       * ┌────────────────┐
       * │ 处理多余的反斜杠  │
       * └──────┬─────────┘       
       *        ↓
       * ┌───────────────────┐
       * │ 去掉前后的空格      │
       * └───────────────────┘
       * 
       */
      var jsonStr = optionsAttr.replace(/'/g, '"').replace(/\\"/g, '"').replace(/\\?"/g, '"').trim();
      if (!jsonStr) {
        /**
         * 空字符串返回空对象
         */
        return defaultValue;    
      } 
      return JSON.parse(jsonStr); // 解析为对象
    } catch (e) {
      console.warn(`解析属性 ${attributeName} 失败，非法 JSON 配置：`, optionsAttr);
      return defaultValue; // 出错时返回空对象，不影响整体流程
    }
  }

  /**
   * @function
   * 合并配置项
   * 
   * @param {Object} target 默认值对象（模板）
   * @param {Object} source 用户配置对象
   * @returns {Object} 合并后的新对象
   * @description
   * 深度合并两个对象，只保留默认值中已有的字段（模板模式）。
   * 用户配置中新增的字段不会被合并进来。
   * 支持嵌套对象、数组、Date、RegExp 等复杂类型。
   * 使用 cloneDeep 实现深拷贝，确保不污染原始对象。
   */
  function deepMergeByTemplate(target, source) {
    // 如果 target 不是对象或为 null，直接返回 target（终止递归）
    if (target === null || layui.type(target) !== 'object') {
      return target;
    }

    // 如果 source 不是对象或为 null，说明用户未提供有效配置，返回默认值
    if (source === null || layui.type(source) !== 'object') {
      return target;
    }

    // 先对默认值对象进行深拷贝，防止污染原始对象
    var merged = cloneDeep(target); 

    // 获取默认值对象的所有键（包括 Symbol 类型），用于以默认值为模板进行合并
    var keys = Reflect.ownKeys(target);

    // 遍历默认值中的所有字段
    layui.each(keys, (i, key) => {
      var targetValue = target[key];
      var sourceValue = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;

      // 如果默认值中的字段是函数，直接保留默认值函数，不被覆盖
      if(layui.type(targetValue) === 'function'){
        merged[key] = targetValue;
      } else {
        // 如果默认值中的字段是对象（且非 null），尝试递归合并
        if(layui.type(targetValue) === 'object' && targetValue !== null){
          // 如果用户配置中也存在该字段，并且也是对象，则递归合并
          if(layui.type(sourceValue) === 'object' && sourceValue !== null){
            merged[key] = deepMergeByTemplate(targetValue, sourceValue);
          } 
          // 否则保留默认值对象（已通过 cloneDeep 拷贝，无需处理）
        } else if(sourceValue !== undefined){
          // 如果默认值中的字段是基础类型（如 string, number, boolean 等）
          // 并且用户配置中存在该字段，则用深拷贝覆盖默认值
          merged[key] = cloneDeep(sourceValue);
        }
      }
    });
    
    // 返回合并后的新对象
    return merged;
  }


  /**
   * 判断字符串是否严格匹配 selectTree(abc) 格式
   * 括号内必须是非空、非空格字符串，且整个字符串不能有额外空格
   * @param {string} str - 要判断的字符串
   * @returns {boolean}
   */
  var isSelectTree = (function(){
    var pattern = /selectTree\((.*)\)$/;

    return function(str){
      if (typeof str !== 'string' || str.trim() === '') {
        return false;
      }

      return pattern.test(str);
    };
  })();

  /**
   * 从selectTree(abc) 格式的字符串中提取括号中的值
   * 
   * @param {string} str - 待提取的字符串
   * @returns {string|null}
   */
  var parseEventFilter = (function(){
    var pattern = /\((.*)\)$/;

    return function(str){

      if (layui.type(str) !== 'string' || !str.trim()) {
        return null;
      }

      var match = str.match(pattern);
      return match && match[1] ? match[1].trim() : null;

    };
  })();

  /**
   * @function
   * 
   * 同步 UI 显示值与树节点状态
   * 在监听的数据变化的时候修改input和dom  , input 已经修改了值的了
   * 
   * @param {HTMLElement|jQuery} dom - 根容器
   * @param {HTMLElement} formItem - 原始 input 元素
   * @param {*} formProxy - formplus 实例
   * @param {string|string[]} value - 待修改的值
   * @returns {boolean} 是否校验通过
   * 
   * @description
   * 1. 将 value 转为字符串（数组则 join）
   * 2. 查找对应节点文本
   * 3. 更新显示 input 的值
   * 4. 刷新树搜索与选中状态
   * 5. 校验节点是否存在（不存在则返回 false）
   */
  var doFixValue = function(dom, formItem, formProxy, value){
    // 强转jquery
    var $this = $(dom);
    // 切换值
    // var setValue = layui.type(value) == 'array' ? value.join(',') : value;
    // 切换值(修改，使用converter进行转化)
    var converterInst = formProxy.findConverter(layui.type(value), 'string');
    var setValue = converterInst instanceof converter ? converterInst.convert.call(formProxy, value) : '';
    // 获取值,并以这个值为准查找出匹配的文字 newValue
    // var oldValue = formItem.value;
    // 查询树的id
    var treeId = $this.find(`[${component.CONST.LAYUI_TREE_ID}]`).attr(component.CONST.LAYUI_TREE_ID);
    // 获取树实例
    var treeInst = formProxy.cacheTree(treeId);
    if(!treeInst) return true;

    var values = [];
    
    if(treeInst.mutiple){
      // // 多选就拆分字符串
      // values = setValue.split(",");
      // 切换值(修改，使用converter进行转化)
      var mutipleConverterInst = formProxy.findConverter(layui.type(setValue), layui.type(values));
      values = mutipleConverterInst instanceof converter ? mutipleConverterInst.convert.call(formProxy, setValue) : [];
      var newValues = [];
      var checkFlag = true;
      if(values.length === 1 && values[0] === '') {
        // 空值特殊处理
        newValues.push("");
      } else {
        // 有实际选项，逐个校验
        // 在树里面找到对应的名称,并拼接结果
        layui.each(values, function(key, value){
          if (value === '') {
            checkFlag = false;
            return true; // 格式错误：不允许空
          }
          var node = $this.find(`[data-id="${escapeSelector(value)}"] .layui-tree-txt`).get(0);
          if(!node) {
            checkFlag = false;
            return true; // 节点不存在
          }
          newValues.push(node.textContent);
        });
      }
      if(!checkFlag){
        return false;
      }
      var converterInst = formProxy.findConverter(layui.type(newValues), 'string', formItem.name);
      // 设置匹配的文字 newValue
      $this.find(`.${component.CONST.CLASS_SELECT_TREE_TITLE}`).val(converterInst.convert.call(formProxy, newValues));
    } else {
      values = [setValue];
      var node = $this.find(`[data-id="${escapeSelector(setValue)}"] .layui-tree-txt`).get(0);
      var nodeContent = '';
      if(!node) {
        if(setValue != ""){
          return false;
        }
      } else {
        nodeContent = node.textContent;
      }
      // 设置匹配的文字 newValue
      $this.find(`.${component.CONST.CLASS_SELECT_TREE_TITLE}`).val(nodeContent);
    }
    // 校验通过，赋值
    formItem.value = setValue;
    treeInst.search(null, values);
    selectedOption(treeInst, values);
    return true;
  };

  /**
   * 点击 input 区域时展开下拉树
   *
   * @function
   * @param {Event} e - 点击事件
   * @param {jQuery} othis - 原始 input 元素
   * @param {*} formProxy - formplus 实例
   * @param {HTMLElement} $root - selectTree节点
   * @param {HTMLElement} formItem - 表单项 DOM
   */
  var onClickTreeInput = function(e, othis, formProxy, formItem, $root){
    // 展开下拉选项
    openSelectTree($(e.target), othis, formProxy, formItem, $root);
    // 阻止事件
    layui.stope(e);
  }

  /**
   * 展开下拉树选择面板
   *
   * @function
   * @param {jQuery} ele - 触发元素
   * @param {jQuery} othis - 原始 input
   * @param {*} formProxy - formplus 实例
   * @param {HTMLElement} $root - selectTree节点
   * @param {HTMLElement} formItem - 表单项
   *
   * @description
   * 1. 关闭其他展开的下拉框
   * 2. 切换当前展开状态
   * 3. 重置滚动条
   * 4. 绑定点击外部关闭事件
   */
  function openSelectTree(ele, othis, formProxy,formItem, $root){
    var CLASS_PREFIX = component.CONST.CLASS_SELECT_STATE_PREFIX;
    // 模拟下拉列表的下拉显隐的原理
    $(`.${CLASS_PREFIX}`).not(ele.parents(`.${CLASS_PREFIX}`)).removeClass(`${CLASS_PREFIX}ed`);
    ele.parents(`.${CLASS_PREFIX}`).toggleClass(`${CLASS_PREFIX}ed`);
    // 将滚动条调整到最上面
    ele.parents(`.${CLASS_PREFIX}`).find("dl").scrollTop(0);

    // 绑定点击外部关闭
    formProxy.removeClickOutsideEvent = lay.onClickOutside(
      ele.parents(`.${CLASS_PREFIX}`)[0],
      function(){
        hideDown(ele.parents(`.${CLASS_PREFIX}`), $root, formProxy,formItem);
      },
      {ignore: ele}
    );
  }

  /**
   * 隐藏下拉面板
   *
   * @function
   * @param {jQuery} choose - 下拉容器
   * @param {HTMLElement} $root - selectTree节点
   * @param {*} formProxy - formplus 实例
   * @param {HTMLElement} formItem - 表单项
   *
   * @description
   * 1. 移除展开类
   * 2. 解绑外部点击事件
   * 3. 延迟同步 UI（兼容前置逻辑，必须 200ms）
   */
  function hideDown (choose, $root, formProxy, formItem){
    choose.removeClass(`${component.CONST.CLASS_SELECT_STATE_PREFIX}ed`);
    formProxy.removeClickOutsideEvent && formProxy.removeClickOutsideEvent();
    setTimeout(function(){
      doFixValue($root, formItem, formProxy, formProxy.getData(formItem.name))
    } , 200);
  }


  /**
   * @function
   * 给树实例添加选中的样式
   * 
   * @param {*} treeInst 树实例
   * @param {string | array<string>} values   需要选中的值
   * 
   * @description
   * 查找 data-id 匹配的节点，为其 .layui-tree-txt 添加 TREE_SELECTED_CSS 类
   */
  var selectedOption = function(treeInst, values){
    if(layui.type(values) != 'array') values = [values];
    var $elem = treeInst.config.elem;
    layui.each(values, (key, value) => {
      var $txt = $elem.find(`[data-id="${escapeSelector(value)}"] .layui-tree-txt`).eq(0);
      if ($txt.length) {
        $txt.addClass(TREE_SELECTED_CSS);
      }
    });
  }

  /**
   * 为带有 lay-hint 属性的 select 元素启用自动补全功能。
   * 
   * 该功能监听输入事件，在用户输入时尝试匹配下拉选项，
   * 并在输入框旁显示灰色补全提示（类似 IDE 的自动补全）。
   * 支持方向键导航、Tab 键确认、失焦校验等交互行为。
   * 
   * @param {*} formItem  - 表单对象
   * @param {*} formProxy - formplus 实例
   * @returns 
   */
  function enableComplate(formItem, formProxy){
    /**
     * 判断是否有lay-search属性
     */
    if(!formItem.hasAttribute("lay-search")) return;

    var $partent = $(formItem.parentElement);

    /**
     * 初始化或获取用于测量文本宽度的隐藏 span
     */
    if(!component.CONST.RECORD_SPAN) {
      component.CONST.RECORD_SPAN = $(
        '<span style="visibility: hidden;position: absolute;z-index: -1;"></span>'
      );
      $("body").append(component.CONST.RECORD_SPAN);
    }

    /**
     * 初始化或获取用于显示补全提示的 div
     */
    if(!component.CONST.COMPLETE_SPAN) {
      component.CONST.COMPLETE_SPAN = $(
        '<div class = "layui-form-autoSelect" ></div>'
      );
      $("body").append(component.CONST.COMPLETE_SPAN);
    }

    // 事件绑定
    $partent.on("input propertychange", "input", function (e) {
      // 输入框在输入的时候就进行匹配补全的操作
      debounce(function (){
        autoComplete(formItem, e);
      });
    });

    $partent.on("blur", "input", function (e) {
      cancelComplete(e);
      /**
       * formItem 的 取值同步
       */
      var oldValue = formProxy.getData(formItem.name);
      if(formItem.value != oldValue && !formItem.value){
        formItem.value = oldValue;
        formRender.call(layui.form, 'select', formProxy.config.id);
      }
    });

    $partent.on("keydown", "input", function (e) {

      if (e.keyCode == 38 || e.keyCode == 40) {
        /**
         * 上下方向键：重新匹配自动补全项
         * 用户正在选择选项，关闭自动推荐判断环节
         */
        autoComplete(formItem, e, false);
      }

      if (e.keyCode == 9) {
        /**
         * Tab 键：确认当前推荐项
         * 隐藏补全提示层
         */
        cancelComplete(e);
      }

      // Enter 键由 layui 默认处理，无需干预
    });

  }

  /**
   * 执行自动匹配和提示逻辑。
   * 
   * 根据当前输入值，在 select 的下拉选项中查找匹配项，
   * 若存在以输入内容开头的选项，则显示补全提示。
   * 
   * @param {*} formItem - 表单对象
   * @param {*} e        - DOM 事件对象
   * @param {*} auto     - 是否处于自动推荐模式（true=推荐，false=仅导航）
   * @returns 
   */
  function autoComplete(formItem, e, auto = true){
    var $target = $(e.target);
    // 去掉前后空格的影响
    var inputVal = String($target.val()).trim();

    // 输入为空时，取消补全
    if (!inputVal) {
      cancelComplete(e); 
      return;
    }

    // 精确定位到该 select 的下拉列表中的 dd 项
    var $ddList = $(formItem).siblings('.layui-form-select').find('dl').children('dd');
    /**
     * 第一个可见有效项（用于推荐）
     * @type {HTMLElement|null}
     */
    var firstVisibleOption = null;
    /**
     * layui 当前选中项
     * @type {HTMLElement|null}
     */
    var matchedSelectedOption = null;
    /**
     * 第一个文本匹配项（用于中文输入 fallback）
     * @type {HTMLElement|null}
     */
    var firstTextMatchOption = null;
    /**
     * 是否存在默认选中项（无 lay-value 的项）
     * @type {boolean}
     */
    var isDefaultItemSelected = false;

    // 遍历所有 dd 项进行匹配判断
    $ddList.each(function(){
      var $dd = $(this);
      var ddText = $dd.text();

      // 获取 lay-value 属性
      var layValue = $dd.attr('lay-value');

      // 检查是否为有效选项 (有 lay-value) 证明是由值的选项，默认值项被剔除
      if (typeof layValue !== 'undefined' && layValue !== "0") {
        // 检查是否可见，判断没得layui-hide 类
        if (!$dd.hasClass(component.CONST.CLASS_HIDE)) {
          // 记录第一个可见项 (用于推荐)
          // 当前eleFirst没有被赋值，并且是推荐状态，就将当前dd项作为 eleFirst
          if (!firstVisibleOption && auto) {
            firstVisibleOption = this;
          }
          // 检查 layui 是否选中了此项
          if ($dd.hasClass(component.CONST.CLASS_THIS)) {
            // 如果是非推荐状态，或者推荐状态再次校验成功，将当前dd项作为 eleSelect
            if (!matchedSelectedOption && (ddText.indexOf(inputVal) >= 0 || !auto)) {
              matchedSelectedOption = this;
            }
          }
        }
        /**
         * 在输入中文字的过程中，没有匹配到会隐藏所有项，导致输入结束的瞬间也匹配不到选项。这里手动匹配第一个适合的选项
         * (特别说明，这里是处理中文输入时的特殊处理)
         */
        if (!firstTextMatchOption && ddText.indexOf(inputVal) >= 0) {
          firstTextMatchOption = this;
        }
      } else {
        // 检查默认项是否被选中
        // 如果这个项有被选中的class样式,并且是可选的状态(没有layui-hide)那就判断当前有dd项被选中
        isDefaultItemSelected = $dd.hasClass(component.CONST.CLASS_THIS) && !$dd.hasClass(component.CONST.CLASS_HIDE);
      }
    });

    // 如果默认项被选中，关闭补全
    if (isDefaultItemSelected) {
      cancelComplete(e);
      return;
    }

    /**
     * 优先使用文本匹配项作为推荐项
     */
    if (firstTextMatchOption) {
      firstVisibleOption = firstTextMatchOption;
    }

    /**
     * 若无选中项且处于推荐模式，将推荐项设为选中
     */
    if (!matchedSelectedOption && firstVisibleOption && auto) {
      $ddList.removeClass(component.CONST.CLASS_THIS);
      $(firstVisibleOption).addClass(component.CONST.CLASS_THIS);
      matchedSelectedOption = firstVisibleOption;
    }

    // 最终无可选项目，关闭补全
    if (!matchedSelectedOption) {
      cancelComplete(e);
      return;
    }

    // 开始计算和显示补全提示
    /**
     * 当前推荐项的展示内容
     */
    var selectText = $(matchedSelectedOption).text();
    /**
     * 记录补全信息
     */
    var suggestionText = '';

    // 只有当选项文本以输入内容开头时才进行补全
    if (selectText.indexOf(inputVal) === 0) {
      suggestionText = selectText.substring(inputVal.length);
    } else {
      cancelComplete(e);
      return;
    }

    // 获取测量用 span 和提示层
    var $textMeasurementSpan = component.CONST.RECORD_SPAN;
    var $suggestionLayer = component.CONST.COMPLETE_SPAN;

    // 同步样式并测量输入框文本宽度
    $textMeasurementSpan.css('font-size', $target.css('font-size'))
      .css('font-family', $target.css('font-family'))
      .text(inputVal);

    var inputRect = e.target.getBoundingClientRect();
    var recordWidth = $textMeasurementSpan.get(0).getBoundingClientRect().width;
    var paddingLeft = parseFloat($target.css('padding-left')) || 0;
    var textIndent = parseFloat($target.css('text-indent')) || 0;
    var cursorLeft = inputRect.x + paddingLeft + textIndent + recordWidth + 2; // +2 防止光标重叠

    // 设置 completeSpan 的样式和内容
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;
    $suggestionLayer.text(suggestionText)
      .css('font-size', $target.css('font-size'))
      .css('font-family', $target.css('font-family'))
      .css('line-height', inputRect.height + 'px')
      .css('height', inputRect.height + 'px')
      .css('top', scrollTop + inputRect.y + 'px')
      .css('left', scrollLeft + cursorLeft + 'px')
      .css('display', 'block')
      .attr('complete', 'true'); // 标记状态
  }

  /**
   * 取消自动补全显示。
   * 
   * 隐藏补全提示层，并清空内容。
   * 
   * @param {*} e         - DOM 事件对象
   * @param {*} formItem  - 表单对象
   * @param {*} formProxy - formplus 实例
   */
  function cancelComplete(e, formItem, formProxy){
    if(component.CONST.COMPLETE_SPAN) {
      component.CONST.COMPLETE_SPAN.css("display", "none").attr("complete", "false").text('');
    }
  }

  /**
   * @method wave
   * 添加水波纹动画效果到指定容器内的按钮元素。
   * 
   * 该函数会检查是否已渲染过（通过 `lay-wave` 属性），避免重复初始化。
   * 支持通过 `lay-options` 属性或函数参数 `option` 配置动画类型、颜色、触发方式等。
   * 波纹元素的创建和事件绑定均在此函数内完成。
   * 
   * @param {jQuery} destination - 包含目标按钮的 jQuery 对象容器。
   * @param {Object} [option={}] - 可选的配置项对象。此参数的优先级高于元素的 `lay-options` 属性。
   * @param {string} [option.type='inset'] - 动画类型，可选值：'inset' (内扩), 'out' (外扩)。
   * @param {string} [option.color='#000000'] - 波纹颜色，支持十六进制、rgb、rgba 等 CSS 颜色值。
   * @param {string} [option.borderRadius='2px'] - 波纹圆角（仅 `out` 类型生效），需包含单位（如 '2px', '50%'）。
   * @param {string} [option.spreadWidth='6px'] - 波纹扩散宽度（仅 `out` 类型生效），需包含单位。
   * @param {string} [option.spreadSize] - 波纹扩散大小（仅 `inset` 类型生效），需包含单位。若未设置，则根据按钮尺寸自动计算。
   * @param {string} [option.trigger='click'] - 触发方式，可选值：'click' (点击), 'mouseenter' (鼠标移入), 'always' (常驻动画)。
   * @param {boolean} [option.center=false] - 波纹起始位置是否居中（仅 `inset` 类型生效）。`false` 时从点击位置开始。
   * 
   * @returns {void}
   * 
   * @example
   * // 基本用法
   * wave($('#myButtonContainer'));
   * 
   * // 使用参数覆盖配置
   * wave($('#myButtonContainer'), {
   *   type: 'out',
   *   color: 'rgba(255, 0, 0, 0.5)',
   *   trigger: 'mouseenter'
   * });
   */
  function wave (destination, option = {}) {
    // 1. 健壮性：确保 destination 是有效的 jQuery 对象且包含元素
    if (!destination || !destination.jquery || destination.length === 0) {
      console.warn('wave: destination 必须是一个非空的 jQuery 对象');
      return;
    }
    // 2. 渲染过一次之后防止重复渲染
    if(destination.attr("lay-wave")){
      return;
    }

    // 3. 缓存 DOM 查询
    var $button = destination.find('button').first(); // 假设只有一个 button
    if ($button.length === 0) {
      console.warn('wave: destination 中未找到 button 元素');
      return;
    }

    // 4. 处理配置项参数
    var optionsAttr = destination.attr(component.CONST.LAYUI_OPTIONS);
    var options = {};
    if(optionsAttr){
      try {
        // 安全解析 JSON，替换单引号为双引号
        options = JSON.parse(String(optionsAttr).replace(/\'/g, () => '"'));
      } catch (e) {
        console.error('wave: lay-options 属性的 JSON 格式无效', e);
        // options 保持为空对象 {}
      }
    }

    // 合并配置，参数 option 优先级最高
    var opt = {
      type: option.type || options.type || 'inset', // or out
      color: option.color || options.color || '#000000', // or rgba
      borderRadius: option.borderRadius || options.borderRadius || '2px', // 仅 out 类型生效,需要带上px 或者直接是填百分比
      spreadWidth: option.spreadWidth || options.spreadWidth || '6px',// 仅 out 类型生效
      spreadSize: option.spreadSize || options.spreadSize,// 仅 inset 类型生效
      trigger: option.trigger || options.trigger || 'click', // 触发方式 click always mouseenter
      center: option.center || options.center || false,// 仅 inset 类型生效  true or false
    };

    // 5. 缓存尺寸
    var btnWidth = $button.outerWidth(true);
    var btnHeight = $button.outerHeight(true);

    // 6. 计算 spreadSize（如果未设置）
    if (!opt.spreadSize) {
      opt.spreadSize = (Math.max(btnWidth, btnHeight) + 20) + 'px';
    }

    // 7. 生成样式字符串
    var style = opt.type == 'inset' ? `left: ${btnWidth / 2}px; top: ${btnHeight / 2}px;` : `width: ${btnWidth}px;`;

    // 8. 创建波纹元素
    var waveArea = `
      <div class="${opt.type == 'inset' ? component.CONST.CLASS_WAVE_INSET_RIPPLES : component.CONST.CLASS_WAVE_OUT_RIPPLES}${opt.trigger == 'always' ? ` ${component.CONST.CLASS_WAVE_ALWAYS}--${opt.type == 'inset' ? 'inset' : 'out'}` : ''}" style="border-radius: ${opt.type == 'inset' ? '50%' : opt.borderRadius}; --layui-ripple-color: ${opt.color}; --layui-spread-width: ${opt.spreadWidth}; --layui-spread-size: ${opt.spreadSize}; ${style} "></div>
    `;
    destination.append($(waveArea));
    destination.attr("lay-wave", true);

    // 9. 设置容器样式(防止内容器扩展动画出现滚动条)
    if(opt.type == 'inset'){
      destination.css({
        'overflow': 'hidden',
      });
    }

    // 10. 添加点击事件
    if (opt.trigger === 'click') {
      $button.on('click', (e) => {
        setRipplePosition(e, opt, $button, destination, btnWidth, btnHeight);
        waveAnimateIn(destination, opt);
        setTimeout(() => {
          waveAnimateOut(destination, opt);
        }, 1000);
      });
    } 
    
    // 10. 添加 mouseenter、mouseleave 事件
    if (opt.trigger === 'mouseenter') {
      destination.on('mouseenter', 'button', function(e){
        setRipplePosition(e, opt, $button, destination, btnWidth, btnHeight);
        waveAnimateIn(destination, opt);
      }).on('mouseleave', 'button', function(){
        waveAnimateOut(destination, opt);
      });
    }

  }

  /**
   * @function waveAnimateIn
   * 触发波纹元素的进入动画。
   * 
   * 通过为波纹元素添加特定的 CSS 动画类名来启动动画。
   * 如果动画类已存在，则不重复添加。
   * 
   * @param {jQuery} destination - 包含波纹元素的容器 jQuery 对象。
   * @param {Object} opt - 包含动画配置的对象，特别是 `type` 字段用于确定使用哪个波纹元素和动画类。
   * @param {string} opt.type - 动画类型 ('inset' 或 'out')，用于确定目标元素和类名。
   * 
   * @returns {void}
   * 
   * @private
   */
  function waveAnimateIn (destination, opt) {
    var $ripples = destination.find(`.${opt.type === 'inset' ? component.CONST.CLASS_WAVE_INSET_RIPPLES : component.CONST.CLASS_WAVE_OUT_RIPPLES}`);
    var className = `${component.CONST.CLASS_WAVE_ONCE}--${opt.type === 'inset' ? 'inset' : 'out'}`;
    if (!$ripples.hasClass(className)) {
      $ripples.addClass(className);
    }
  }

  /**
   * @function waveAnimateOut
   * 触发波纹元素的退出动画或移除动画状态。
   * 
   * 通过移除波纹元素上特定的 CSS 动画类名来停止或重置动画。
   * 
   * @param {jQuery} destination - 包含波纹元素的容器 jQuery 对象。
   * @param {Object} opt - 包含动画配置的对象，特别是 `type` 字段用于确定使用哪个波纹元素和动画类。
   * @param {string} opt.type - 动画类型 ('inset' 或 'out')，用于确定目标元素和类名。
   * 
   * @returns {void}
   * 
   * @private
   */
  function waveAnimateOut (destination, opt) {
    var $ripples = destination.find(`.${opt.type === 'inset' ? component.CONST.CLASS_WAVE_INSET_RIPPLES : component.CONST.CLASS_WAVE_OUT_RIPPLES}`);
    var className = `${component.CONST.CLASS_WAVE_ONCE}--${opt.type === 'inset' ? 'inset' : 'out'}`;
    $ripples.removeClass(className);
  }

  /**
   * @function setRipplePosition
   * （仅用于 `inset` 类型且 `center` 为 `false` 时）
   * 根据鼠标点击事件，动态设置内扩波纹 (`inset`) 的起始位置和扩散尺寸。
   * 
   * 会修改波纹元素的 `left`、`top` 样式以及 `--layui-spread-size` CSS 自定义属性。
   * 
   * @param {Event} e - 鼠标点击事件对象。
   * @param {Object} opt - 动画配置对象，用于判断是否需要执行此操作。
   * @param {string} opt.type - 动画类型，必须为 'inset' 才会执行。
   * @param {boolean} opt.center - 是否居中，`true` 时此函数不执行任何操作。
   * @param {jQuery} $button - 按钮元素的 jQuery 对象，用于获取位置信息。
   * @param {jQuery} destination - 容器元素的 jQuery 对象，用于查找波纹元素。
   * 
   * @returns {void}
   * 
   * @private
   */
  function setRipplePosition(e, opt, $button, destination, btnWidth, btnHeight){
    if (opt.type !== 'inset' || opt.center) return;

    var rect = $button[0].getBoundingClientRect();
    var offsetX = e.clientX - rect.left;
    var offsetY = e.clientY - rect.top;
    var x = Math.max(offsetX, btnWidth - offsetX);
    var y = Math.max(offsetY, btnHeight - offsetY);
    var spreadSize = Math.sqrt(x * x + y * y) * 2 + 20;

    var $ripples = destination.find(`.${component.CONST.CLASS_WAVE_INSET_RIPPLES}`);
    $ripples.css({
      'left': `${offsetX}px`,
      'top': `${offsetY}px`,
      '--layui-spread-size': `${spreadSize}px`
    });
    // 确保 CSS 变量更新
    $ripples[0].style.setProperty('--layui-spread-size', `${spreadSize}px`);

  }

  /**
   * 判断元素是否应被忽略
   * @param {*} elem 
   * @returns 
   */
  function shouldIgnoreElement(elem) {
    return elem.hasAttribute(component.CONST.LAYUI_IGNORE) || 
      elem.hasAttribute(component.CONST.LAYUI_IGNORE_PLUS);
  }

  /**
   * 应用合适的渲染器
   * @param {*} formProxy 
   * @param {*} formItem 
   * @param {*} formType 
   * @param {*} containerDOM 
   * @returns 
   */
  function applyRenderer(formProxy, formItem, formType, containerDOM) {
    var customRenderer = formProxy.findRenderer(formItem, formItem.type, formType);
    
    if (customRenderer instanceof Renderer) {
      customRenderer.render(containerDOM, formItem, formProxy);
      return;
    }

    // 使用内置渲染器
    layui.each(formRenderers, function(key, renderer) {
      if (renderer.canRender(formItem, formItem.type, formType)) {
        renderer.render(containerDOM, formItem, formProxy);
        return true; // 中断遍历
      }
    });
  }

  /**
   * 确定表单类型
   * @param {*} formItem 
   * @returns 
   */
  function getFormType(formItem) {
    if (!formItem || !formItem.tagName) {
      return 'input';
    }
    var tagName = formItem.tagName.toLowerCase();
    var typeAttr = formItem.type;

    // 特殊处理：switch
    if (typeAttr === 'checkbox' && formItem.getAttribute('lay-skin') === 'switch') {
      return 'switch';
    }

    // 映射类型
    if (typeAttr === 'checkbox') return 'checkbox';
    if (typeAttr === 'radio') return 'radio';
    if (tagName === 'select') return 'select';
    return 'input'; // 默认为 input
  }

  /**
   * 在转换器列表中查找第一个匹配项
   * @private
   * @param {Array} list 转换器数组
   * @param {Object} context 调用 support 方法时的 this 上下文
   * @param {*} I 输入类型
   * @param {*} O 输出类型
   * @param {String} name 字段名
   * @returns {converter|null} 匹配的转换器，未找到返回 null
   */
  function findConverterInList(list, context, I, O, name) {
    var result = null;
    layui.each(list, function(key, item) {
      if (item.support.call(context, I, O, name)) {
        result = item;
        return true; // 中断遍历
      }
    });
    return result;
  }

  /**
   * 防抖
   * @param {*} isClear 传入一个函数,则第二个参数是一个配置项;传入一个boolean,则代表阻止第二个参数(函数)的执行
   * @param {*} fn 配置项 or 执行函数
   */
  function debounce(isClear, fn = {}) {
    if (layui.type(isClear) != 'function') {
      fn._throttleID && clearTimeout(fn._throttleID);
    } else {
      debounce(true, isClear);
      var param = {
        context: fn.context || null,
        args: fn.args || [],
        time: fn.time || 300
      };
      isClear._throttleID = setTimeout(function () {
        isClear.apply(param.context, param.args);
      }, param.time);
    }
  };

  /**
   * @function
   * 深拷贝
   * 
   * @param {*} o 待深拷贝的对象
   * @returns {*} 深拷贝后新产生的对象
   */
  function cloneDeep(o){
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
          if (layui.type(o) == 'array') {
            res = [];
            layui.each(o, (k,v) => {
              res.push(cloneDeep(v))
            });
          } else if (layui.type(o) == 'date') {
            res = new Date();
            res.setTime(o.getTime());
          } else if (layui.type(o) == 'object') {
            res = {};
            layui.each(o, (k,v) => {
              res[k] = cloneDeep(v);
            });
          } else if (layui.type(o) == 'regexp') {
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
  }

  /**
   * @function
   * 判断是否为时间选择器（由属性标识）
   * 
   * @param {HTMLElement} formItem 表单 DOM 对象
   * @returns {boolean} 是否为时间选择器
   * @description
   * 满足以下任一条件即视为时间选择器：
   *  - 属性中直接指定 laydate
   *  - 属性中有 lay-key 表明 laydate 组件渲染完毕
   *  - 属性中有 lay-laydate-id 表明 laydate 组件渲染完毕
   */
  function isDatePickerElement(formItem) {
    var attrs = [component.CONST.LAYUI_DATE, component.CONST.LAYUI_ALREADY_DATE_1, component.CONST.LAYUI_ALREADY_DATE_2];
    var res = false;
    layui.each(attrs, (k, attr) => {
      res = formItem.hasAttribute(attr);
      return res; // 存在则 return true，中断循环
    });
    return res;
  }

  /**
   * @function
   * 判断是否为下拉树（select-tree）结构
   * 
   * @param {HTMLElement} formItem 表单 DOM 对象
   * @returns {boolean} 
   * @description
   * 下拉树（select-tree）结构特征：
   *  - input 外层包裹 layui-select-title
   *  - 再外层包裹 layui-form-select
   */
  function isSelectTreeElement(formItem) {
    var parent = formItem.parentNode;
    if (!parent) return false;

    var root = parent.parentNode;
    if (!root) return false;
  
    // 兼容性写法：支持 classList 和 className
    var hasParentClass = parent.classList 
      ? parent.classList.contains(component.CONST.CLASS_SELECT_TREE_OUTER_TITLE)
      : ` ${parent.className} `.indexOf(` ${component.CONST.CLASS_SELECT_TREE_OUTER_TITLE} `) > -1;

    var hasRootClass = root.classList 
      ? root.classList.contains(component.CONST.CLASS_SELECT_STATE_PREFIX)
      : ` ${root.className} `.indexOf(` ${component.CONST.CLASS_SELECT_STATE_PREFIX} `) > -1; 

    return hasParentClass && hasRootClass;
  }

  /**
   * @function
   * 更新表单元素的字数提示显示
   * 
   * @param {HTMLElement} formItem - 表单 DOM 元素
   * @param {string} value - 当前输入值
   * @param {number} maxlength - 最大长度限制
   * @param {string} attrName - 要设置的 DOM 属性名（如 'dataMaxlength'）
   * 
   * @description
   * 更新父元素的指定属性为 "当前长度/最大长度" 格式文本
   * 
   */
  function updateMaxlengthDisplay(formItem, value, maxlength, attrName) {
    var length = String(value || '').length;
    var text = `${length}/${maxlength}`;

    if (formItem.parentElement) {
      formItem.parentElement.setAttribute(attrName, text);
    }
  }

  /**
   * @function
   * 处理 maxlength 字数限制
   * 
   * @param {HTMLElement} formItem 表单 DOM 对象
   * @param {*} formProxy formplus 实例
   * 
   * @description
   * 1. 解析 maxlength 属性
   * 2. 初始化字数显示
   * 3. 监听数据变化并更新显示
   * 4. 同步缓存字段（name-limit）
   */
  function handleMaxlength(formItem, formProxy) {
    var attrValue = formItem.getAttribute('maxlength');
    if (attrValue == null) return;

    var maxlength = parseInt(attrValue, 10);
    if (isNaN(maxlength) || maxlength <= 0) return;

    var tempName = `${formItem.name}-limit`;
    var attrName = 'dataMaxlength';
  
    // 初始化显示
    updateMaxlengthDisplay(formItem, formItem.value, maxlength, attrName);
    formProxy.setData(tempName, `${String(formItem.value).length}/${maxlength}`);

    // 监听数据变化
    formProxy.on(formItem.name, function(obj){
      updateMaxlengthDisplay(formItem, obj.value, maxlength, attrName);
      formProxy.setData(tempName, `${String(obj.value).length}/${maxlength}`);
    });
  }

  /**
   * @function
   * 处理 lay-affix 特殊行为
   * 
   * @param {HTMLElement} formItem 表单 DOM 对象
   * @param {*} formProxy formplus 实例
   * @param {String} formFilter lay-filter 值
   * 
   * @description
   * 仅处理 lay-affix="number" 和 "clear"
   * 绑定 input-affix 事件，同步数据到 formProxy
   */
  function handleAffix(formItem, formProxy, formFilter) {
    
    /**
     * 获取 affix 属性,仅处理 数字-number 和 清空-clear 两类内置 affix
     * 其他自定义 affix 需要自行实现
     */
    var affix = formItem.getAttribute('lay-affix');
    if (affix !== 'number' && affix !== 'clear') return;

    /**
     * 绑定 change 事件
     */
    layui.form.on(`input-affix(${formFilter})`, function (data) {
      formProxy.setData(formItem.name, data.elem.value);
    });
  }

  /**
   * @function
   * 渲染下拉树核心（layui.tree）
   * 
   * @param {jQuery} $ddDom - dd 容器
   * @param {Object} options - 配置
   * @param {jQuery} $root - 根容器
   * @param {jQuery} $input - 原始 input
   * @param {jQuery} $nameDom - 名称显示框
   * @param {*} formProxy formplus 实例
   * @param {String} filter lay-filter 值
   * @param {HTMLElement} formItem - 表单项元素
   * 
   * @description
   * 使用 layui.tree 渲染下拉树，支持多选、搜索、异步加载。
   * 绑定 click、input、ajax 数据更新等逻辑。
   * 
   * 支持：
   * - 单选/多选切换
   * - 搜索过滤
   * - 异步数据加载
   * - 外部事件拦截（selectTree(filter)）
   */
  function renderTreeComponent($ddDom, options, $root, $input, $nameDom, formProxy, filter, formItem) {
    layui.use(['tree', 'treeorder'], function(){
      // 渲染树
      var treeInst = layui.tree.render({
        elem: $ddDom,
        id: options.id,
        onlyIconControl: options.onlyIconControl,
        data: options.data,
        customName: options.customName,
        showCheckbox: false,  // 固定为 false，由 click 逻辑控制显示行为
        click: function (obj) {
          var id = String(obj.data[options.customName.id]);
          var title = obj.data[`*${options.customName.title}`] || obj.data[options.customName.title];

          // 触发外部事件，支持拦截
          // 点击事件时回去触发 layui.form.on('selectTree(filter)', fn) 事件,事件返回false时不会触发下面的赋值操作,返回不是false触发赋值操作
          var shouldContinue = layui.event.call(formProxy, component.CONST.MOD_NAME, `selectTree(${filter}-[${component.CONST.MOD_ID}-${formProxy.config.id}])`, {
            elem: $input.get(0),
            value: obj.data,
            othis: $root
          }) !== false;

          if (!shouldContinue) return;

          var values = [];

          if (options.showCheckbox) {
            // 多选模式：toggle 选中状态
            var currentValues = formProxy.getData(formItem.name);
            var index = currentValues.indexOf(id);
            if (index > -1) {
              currentValues.splice(index, 1);
            } else {
              currentValues.push(id);
            }
            // 过滤，如果currentValues的length大于1，那要去掉空值
            if (currentValues.length > 1) {
              // 创建一个新数组，只包含非空字符串的项
              var filteredValues = currentValues.filter(function(value) {
                return !!value; // 过滤掉空字符串 ""
              });
              formProxy.setData(formItem.name, filteredValues);
              values = filteredValues;
            } else {
              formProxy.setData(formItem.name, currentValues);
              values = currentValues; 
            }
          } else {
            // 单选模式
            $input.val(id);
            $nameDom.val(title);
            formProxy.setData(formItem.name, id);
            values.push(id);
          }

          // 更新树节点选中状态
          selectedOption(treeInst, values);

          // 控制下拉框关闭：非多选或未启用 checkbox 时关闭
          if (!(options.showCheckbox == true && options.checkbox == true)) {
            $root.removeClass(`${component.CONST.CLASS_SELECT_STATE_PREFIX}ed ${component.CONST.CLASS_SELECT_STATE_PREFIX}up`);
          }

          // 同步数据
          doFixValue($root, formItem, formProxy, values);
        }
      }, true);

      // 缓存树实例
      $ddDom.attr(component.CONST.LAYUI_TREE_ID, treeInst.config.id);

      // 缓存树实例
      treeInst.mutiple = !!options.showCheckbox;
      treeInst.checkbox = !!options.checkbox;
      formProxy.cacheTree(treeInst.config.id, treeInst);

      // 搜索输入处理
      $nameDom.on('input propertychange', function () {
        var keyword = this.value;
        var treeId = $root.find(`[${component.CONST.LAYUI_TREE_ID}]`).attr(component.CONST.LAYUI_TREE_ID);
        var treeInst = formProxy.cacheTree(treeId);
        if (!treeInst) return;

        // 自动展开
        if (!$root.hasClass(`${component.CONST.CLASS_SELECT_STATE_PREFIX}ed`) && 
        !$root.hasClass(`${component.CONST.CLASS_SELECT_STATE_PREFIX}up`)) {
          $nameDom.trigger('click');
        }

        var values = formProxy.getData(formItem.name);
        treeInst.search(keyword, values);

        // 更新树节点选中状态
        selectedOption(treeInst, values);
      });

      // 监听原始 input 变化（外部赋值）
      $input.on('input propertychange', function () {
        doFixValue($root, formItem, formProxy, formProxy.getData(formItem.name));
      });

      // 动态加载数据
      // 在配置项上面添加了数据源时,使用ajax请求更新树的数据源
      if (options.url) {
        var param = options.where || {};
        $.ajax({
          url: options.url,
          type: options.type || 'GET',
          headers: options.headers || {},
          data: options.dataType !== 'json' ? param : JSON.stringify(param),
          success: (res) => {
            var code = res[options.statusName || 'code'];
            var data = res[options.dataName || 'data'];
            if (code === (options.statusCode || 200) && layui.type(data) == 'array') {
              layui.treeorder.setSource(treeInst.config.id, data);
              // 获取当前树的值
              var treeValue = formProxy.getData(formItem.name);
              treeInst.search(null, treeValue);
              // 同步一下当前的tree
              doFixValue($root, formItem, formProxy, treeValue);
            }
          }
        });
      } else {
        // 同步一下当前的tree
        doFixValue($root, formItem, formProxy, formProxy.getData(formItem.name));
      }
    });
  }

  /**
   * 为 Layui layDate 组件准备农历增强选项
   * 
   * 功能：
   * - 阻止默认预览，注入自定义农历信息
   * - 在预览区显示农历、节气、节假日、班休标识
   * - 在日期单元格显示农历简写与高亮
   * - 支持年/月面板显示农历信息
   * - 兼容 Layui 2.10.3+ 的 DOM 重建问题（面板销毁重建）
   * - 右键弹出完整农历详情（节气、干支、生肖等）
   * 
   * @param {Object} options - layDate 原始配置对象（会被修改并返回）
   * @returns {Object} 修改后的 options，已注入农历相关事件
   */
  function prepareLunarOption(options){
    // -----------------------------
    // 基础配置优化
    // -----------------------------

    /**
     * 关闭 Layui 内置预览，避免与自定义渲染冲突
     * @type {boolean}
     * 阻止下方直接预览信息,这里是需要通过事件特殊处理的
     */
    options.isPreview = false;

    /**
     * 限制按钮数量，防止遮挡下方预览区域
     * 只保留“清空”和“现在”按钮
     * @type {string[]}
     */
    options.btns = ['clear', 'now'];

    // -----------------------------
    // 事件注入
    // - change,onNow 事件的定义高度一致
    // - ready 事件有一个前置设置 _previewEl 的过程，将 _previewEl 放到 cellRender回调中判断
    // -----------------------------

    /**
     * 页面首次加载或重新打开日历面板时触发
     * 初始化预览区域引用，并渲染当前选中日期的农历信息
     */
    options.ready = function(date) {
      // 初始化或恢复 _previewEl 引用
      if (!this._previewEl) {
        this._previewEl = initPreviewEl(this);
      }
      // 触发一次渲染，确保预览区显示正确信息
      this.cellRender(date);
    };

    // 用户切换日期时触发，监听日期切换和“当前时间”按钮点击
    // 两者行为一致：重新渲染当前日期的农历信息
    ['change', 'onNow'].forEach(event => {
      options[event] = function(value, date) {
        // 渲染当前日期的农历信息
        this.cellRender(date);
      };
    });
    
    /**
     * 核心渲染函数：控制每个单元格和预览区的内容
     * 将实际渲染逻辑委托给外部函数 cellRender，保持 this 上下文
     */
    options.cellRender = function (ymd, render, info) {
      cellRender.call(this, ymd, render, info, options)
    };
    return options;
  }

  /**
   * 自定义单元格与预览区渲染函数
   * 
   * 此函数会被 Layui 在渲染每个日期、月份、年份格子时调用
   * 同时也会被 ready/change/onNow 事件触发，用于更新顶部预览
   * 
   * @param {Object} ymd - 日期对象 {year, month, date}
   * @param {Function} [render] - 渲染函数（仅面板调用时存在）
   * @param {Object} [info] - 面板信息 {type: 'date'|'month'|'year'}
   * @param {Object} [options] - 配置项
   * 
   * @this {Object} layDate 实例
   */
  function cellRender(ymd, render, info, options){
    var self = options;
    var {year, month, date} = ymd;

    // 计算农历（只计算一次）
    var solar = Solar.fromYmd(year, month, date);
    var lunar = solar.getLunar();
    var lunarDay = lunar.getDayInChinese();   // 农历日（如“初一”）
    var jieQi = lunar.getJieQi();             // 节气（如“立春”）

    // 节假日处理：获取节日名称与班休状态
    var holidayInfo = null;
    try {
      var holiday = HolidayUtil.getHoliday(year, month, date);
      // 确保 holiday 存在且有 getTarget 方法
      if (holiday && layui.type(holiday.getTarget) === 'function') {
        var holidayTarget = holiday.getTarget();
        var day = holiday.getDay();
        // 节日名称
        var name = holidayTarget === day ? holiday.getName() : null;   
        // 班/休标识 
        var badge = holidayTarget ? (holiday.isWork() ? '班' : '休') : null;
        // 是否为法定假日
        var isHoliday = holidayTarget && !holiday.isWork();
        holidayInfo = {
          name: name,           // 节日名称（如“春节”）
          badge: badge,         // 班/休标识
          isHoliday: isHoliday  // 是否为放假状态
        };
      }
    } catch (e) {
      console.warn('[Lunar] 节假日解析失败:', e.message);
    }
    // 渲染顶部预览区域（仅 date 类型或初始化时）
    // 说明：预览区只在日期选择面板显示，年/月面板不显示
    if(self._previewEl && (!info || info.type === 'date')){
      // 获取有效的预览 DOM 节点（兼容重建）
      var destinationEl = getValidDestinationEl(self._previewEl, self);

      if (destinationEl) {
        try {
          // 生成预览区 HTML 并插入
          destinationEl.innerHTML = renderPreviewContent(solar, lunar, holidayInfo);
        } catch (e) {
          console.error('[Lunar] 预览区渲染失败:', e);
        }
      }
    }
    /**
     * 无 render，说明是初始化调用
     */
    if(!render) return;

    // 渲染日历单元格
    try{
      if(info.type === 'date') {
        // 构建 CSS 类名
        var clazz = 'date-cell-inner';
        if (holidayInfo && holidayInfo.isHoliday) {
          clazz += ' holiday';
        }
        if (holidayInfo && holidayInfo.name || jieQi) {
          clazz += ' hightlight';
        }
        // 构建班休标识 HTML
        var badgeHtml = '';
        if (holidayInfo && holidayInfo.badge) {
          badgeHtml = '<u class="badge">' + holidayInfo.badge + '</u>';
        }
        // 显示文本：优先节日名 > 节气 > 农历日
        var displayText = holidayInfo && holidayInfo.name ? holidayInfo.name : jieQi ? jieQi : lunarDay;
        // 拼接单元格内容
        var content = [
          '<div class="' + clazz + '">',
            '<b>' + date + '</b>',
            '<i>' + displayText + '</i>',
            badgeHtml,
          '</div>'
        ].join('');
        var $content = $(content);
        // 绑定右键事件：弹出完整农历详情
        $content.on('contextmenu', function(e) {
          e.preventDefault();
          try {
            layui.layer.tips(lunar.toString(), this, {
              tips: [1, '#16baaa'],
              zIndex: 999999999,
              // 避免重复创建
              success: function(el) {
                el.setAttribute('data-lunar-tip', 'true');
              }
            });
          } catch (tipErr) {
            console.warn('[Lunar] 提示弹窗失败:', tipErr.message);
          }
        });
        render($content);
      } else if (info.type === 'year') {
        // 年份面板：显示农历年份（如“2025年（乙巳年）”）
        var nextYearFirst = new Date(year + 1, 0); // 下一年正月初一
        var lunarYearObj = Lunar.fromDate(nextYearFirst);
        var lunarYearText = lunarYearObj.getYearInGanZhi() + lunarYearObj.getYearShengXiao();
        render(`${year}年<div style="font-size:12px">${lunarYearText}年</div>`);
      } else if (info.type === 'month') {
        // 月份面板：显示农历月份（如“1月（正月）”）
        var lunarMonth = lunar.getMonthInChinese();
        render(`${month}月(${lunarMonth}月)`);
      }
    } catch (renderErr) {
      console.error('[Lunar] 单元格渲染失败:', renderErr);
    }
  }

  /**
   * 获取有效的预览区域 DOM 节点
   * 
   * 由于 Layui 2.10.3+ 在某些情况下会重建 DOM，
   * 导致之前的 jQuery 引用失效，因此需要动态查找并更新引用。
   * 
   * @param {jQuery} $previewEl - jQuery 包装的预览元素
   * @param {Object} instance - layDate 实例
   * @returns {HTMLElement|null} 有效的 DOM 节点或 null
   */
  function getValidDestinationEl($previewEl, instance){
    var destinationEl = null;

    // 1. 优先使用缓存的 destination（避免重复查找）
    if ($previewEl.destination && document.contains($previewEl.destination)) {
      destinationEl = $previewEl.destination;
    }

    // 2. 检查当前 jQuery 对象是否在 DOM 中
    if (!destinationEl && $previewEl.get(0) && document.contains($previewEl.get(0))) {
      destinationEl = $previewEl.get(0);
    }

    // 3. 若以上均失败，说明 DOM 被重建，需重新查找（兼容 Layui 2.10.3+ 重建问题）
    if (!destinationEl) {
      var newPreviewEl = initPreviewEl(instance.config);    // 重新获取
      var newEl = newPreviewEl.get(0);      // 获取原生 DOM
      if (newEl) {
        // 更新实例引用和缓存
        instance._previewEl = newPreviewEl;
        newPreviewEl.destination = newEl; // 缓存 destination
        destinationEl = newEl;
      }
    }

    return destinationEl;
  }

  /**
   * 生成预览区域 HTML
   * 
   * @param {Object} solar - Solar 实例
   * @param {Object} lunar - Lunar 实例
   * @param {Object|null} holidayInfo - 节假日信息
   * @returns {string} HTML 字符串
   */
  function renderPreviewContent(solar, lunar, holidayInfo){
    // 节假日 badge 样式（班/休）
    var holidayBadgeStyle = 'display:none;'; // 默认隐藏
    if (holidayInfo && holidayInfo.badge) {
      var bgColor = holidayInfo.isHoliday ? '#eb3333' : '#333'; // 放假红，上班灰
      holidayBadgeStyle = [
        'color:#fff',
        'background-color:' + bgColor,
        'display:inline-block'
      ].join(';');
    }

    // 节气/节日 badge 样式
    var festivalBadgeStyle = 'display:none;';
    if (holidayInfo && holidayInfo.name || lunar.getJieQi()) {
      festivalBadgeStyle = [
        'color:#fff',
        'background-color:#1e9fff',
        'display:inline-block'
      ].join(';');
    }

    var festivalText = holidayInfo && holidayInfo.name ? holidayInfo.name : lunar.getJieQi();

    return [
      '<div class="preview-inner">',
        '<div style="color:#333;">农历' + solar.getMonthInChinese() + '月' + solar.getDayInChinese() + '</div>',
        '<div style="font-size:10px">' + solar.getYearInGanZhi() + solar.getYearShengXiao() + '年</div>',
        '<div style="font-size:10px">' + solar.getMonthInGanZhi() + '月 ' + solar.getDayInGanZhi() + '日</div>',
        '<div class="badge" style="' + holidayBadgeStyle + '">' + (holidayInfo.badge || '') + '</div>',
        '<div class="badge" style="' + festivalBadgeStyle + '">' + (festivalText || '') + '</div>',
      '</div>'
    ].join('');
  }


  /**
   * 根据 layDate 实例获取预览区域的 jQuery 对象
   * 
   * 利用 elem 上的 lay-key 属性定位对应的 laydate 面板
   * 
   * @param {*} options - layDate 配置项，包含 elem（绑定元素）
   * @returns {jQuery} 预览区域
   */
  function initPreviewEl(options){
    var key = options.elem.attr(component.CONST.LAYUI_ALREADY_DATE_1);
    var panelEl = $(`#layui-laydate${key}`);
    return panelEl.find('.layui-laydate-preview');
  }

  /**
   * 执行表单元素上面的 lay-event 事件
   * 
   * @param {*} formProxy formplus 实例
   * @param {string} eventKey 事件名称
   * @param {*} evt 回调参数
   */
  function invokeLayEvent(formProxy, eventKey, evt){
    // 查找并使用事件转换器(这里考虑多事件，所以要进行 string -> array<string>的转换)
    var converterInst = formProxy.findConverter(layui.type(eventKey), 'array');
    // 转换事件名
    var events = converterInst instanceof converter ? converterInst.convert.call(formProxy, eventKey) : [String(eventKey)];
    // 触发所有关联的事件
    layui.each(events, (k, event) => {
      formProxy.invokeServiceLocator(event, evt);
    });
  }

  /**
   * 转义字符串中可用于 CSS 选择器的特殊字符
   * 兼容 IE9+ 及所有现代浏览器
   * 
   * @param {String|Number|Boolean} str - 待转义的值
   * @returns {String} 转义后的字符串
   */
  function escapeSelector(str) {
    // 1. 确保输入为字符串
    str = str == null ? '' : String(str);
    
    // 2. 手动转义 CSS 选择器中具有特殊含义的字符
    //    使用字符类匹配，避免正则元字符问题
    return str.replace(/([\\!"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~])/g, '\\$1');
  }

  /**
   * @constructor
   * 表单渲染器
   * 用于定义一个根据条件决定是否渲染表单项的处理器。
   * 
   * @param {Function} condition 判断是否可以由此渲染器进行渲染 (formItem, formType, type) => Boolean
   * @param {Function} render 渲染方法 (item, formItem, formProxy) => void
   * 
   * @throws {TypeError} 当 `render` 参数不是函数时抛出。
   * 
   */
  function Renderer (condition, render){

    /**
     * condition ，非函数时降级为 false
     * 判断当前渲染器是否能处理指定的表单项。
     * @function
     * @param {*} formItem - 表单项配置对象。
     * @param {*} formType - 表单类型。
     * @param {*} type - 具体类型标识。
     * @returns {boolean} - 如果能渲染返回 `true`，否则 `false`。
     */
    this.canRender = layui.type(condition) === 'function' ? condition : () => false;
    // render 是必需的，必须是函数
    if (layui.type(render) !== 'function') {
      throw new TypeError('Renderer: render must be a function');
    }

    /**
     * 执行实际的渲染操作。
     * @function
     * @param {*} item - 待渲染的数据项。
     * @param {*} formItem - 表单项配置。
     * @param {*} formProxy - 表单代理对象（可能用于数据绑定等）。
     */
    this.render = render;
  }

  /**
   * @constructor
   * 类型转化器
   * 用于定义一个判断是否支持类型转换以及执行转换操作的处理器。
   * 
   * @param {*} support  是否支持转化
   * @param {*} convert  执行转换操作的函数。
   * 
   * @throws {TypeError} 当 `support` 或 `convert` 参数不是函数时抛出。
   * 
   * boolean support(I, O, name);
   * O convert(input);
   * 
   */
  function converter (support, convert) {
    // 参数校验
    if (layui.type(support) !== 'function') {
      throw new TypeError('converter: support must be a function');
    }
    if (layui.type(convert) !== 'function') {
      throw new TypeError('converter: convert must be a function');
    }

    /**
     * 判断当前转化器是否支持将输入类型转换为输出类型。
     * 此方法内部会调用构造时传入的 `support` 函数，并确保其 `this` 上下文指向当前转化器实例。
     * @function
     * @param {*} input - 输入值。
     * @param {*} outputType - 期望的输出类型。
     * @param {string} [name] - 可选的名称标识。
     * @returns {boolean} - 如果支持转换返回 `true`，否则 `false`。
     */
    this.support = (...param) => support.apply(this, param);

    /**
     * 执行实际的类型转换操作。
     * 此方法内部会调用构造时传入的 `convert` 函数，并确保其 `this` 上下文指向当前转化器实例。
     * @function
     * @param {*} input - 需要转换的输入值。
     * @returns {*} - 转换后的值。
     */
    this.convert = (...param) => convert.apply(this, param);
  }

  /* 四、组件定义 */

  /**
   * @namespace
   * 创建组件
   */
  var component = layui.component({
    /**
     * @inner {String} 组件名称
     * @desc 在layui.component内部做过处理,后面可以通过 component.CONST.MOD_NAME 获取它的值
     */
    name: KEY,

    /**
     * @inner 
     * 默认配置项
     * 
     * @desc 应该指的是render方法中能传入进来的配置项
     */
    config: {

      /**
       * @inner
       * 默认的叫法,渲染的目的地
       * CONST
       * @type {String|jQuery}
       */
      elem: `.${CLASS_FORM}`, // 这里好像还取不到 component 变量

      /**
       * 表单映射对象
       */
      formData: {},
    },

    /**
     * @inner
     * 组件内常量集合
     * @description
     *  - 外面都可以使用 component.CONST.XXX 调用
     */
    CONST: {
      /**
       * @inner
       * 树组件选中选择的样式
       * @type {string}
       */
      TREE_SELECTED_CSS: TREE_SELECTED_CSS,

      /**
       * @inner
       * form表单中过滤表单项的属性名
       * @type {string}
       */
      LAYUI_FILTER: LAYUI_FILTER,

      /**
       * @inner
       * 标记form表单的样式名称
       * @type {string}
       */
      CLASS_FORM: CLASS_FORM,

      /**
       * @inner
       * layui表单验证 是否懒校验的属性值
       * @type {string}
       * @description
       * <ul>
       *   <li>不设置这个属性 input采用 input onporpertychange 事件监听</li>
       *   <li>设置这个属性值 input采用 onbulr 事件监听</li>
       * </ul>
       */
      LAYUI_LAZY: LAYUI_LAZY,

      /**
       * @inner
       * 标记form表单元素被 form 组件忽略的属性名称
       * @type {string}
       */
      LAYUI_IGNORE: LAYUI_IGNORE,

      /**
       * @inner
       * 标记form表单元素被 formplus 组件忽略的属性名称
       * @type {string}
       */
      LAYUI_IGNORE_PLUS: LAYUI_IGNORE_PLUS,

      /**
       * @inner
       * 标记该表单元素被 formplus 组件识别为时间选择器的属性名称
       * @type {string}
       */
      LAYUI_DATE: LAYUI_DATE,

      /**
       * @inner
       * 标记该表单元素被 formplus 组件识别为已经被 laydate 组件渲染完毕的属性名称
       * @type {string}
       * @description
       * 这个属性的属性值是 laydate 组件的id
       */
      LAYUI_ALREADY_DATE_1: LAYUI_ALREADY_DATE_1,

      /**
       * @inner
       * 标记该表单元素被 formplus 组件识别为已经被 laydate 组件渲染完毕的属性名称
       * @type {string}
       */
      LAYUI_ALREADY_DATE_2: LAYUI_ALREADY_DATE_2,

      /**
       * @inner
       * 标记表单元素用户填写配置项参数的属性名称
       * @type {string}
       */
      LAYUI_OPTIONS: LAYUI_OPTIONS,

      /**
       * @inner
       * layui.tree 组件渲染后标记实例ID的属性名称
       * @type {string}
       */
      LAYUI_TREE_ID: LAYUI_TREE_ID,

      /**
       * @inner
       * 下拉框控制显示/隐藏的样式名前缀，后面追加 - up  or - ed
       * @type {string}
       */
      CLASS_SELECT_STATE_PREFIX: CLASS_SELECT_STATE_PREFIX,

      /**
       * @inner
       * 下拉树组件中标记保存真实值的样式名称
       * @type {string}
       */
      CLASS_SELECT_TREE_VALUE: CLASS_SELECT_TREE_VALUE,

      /**
       * @inner
       * 下拉树组件中标记前端显示值的样式名称
       * @type {string}
       */
      CLASS_SELECT_TREE_TITLE: CLASS_SELECT_TREE_TITLE,

      /**
       * @inner
       * 下拉树组件外层容器骨架的样式名称(包裹 input)
       * @type {string}
       */
      CLASS_SELECT_TREE_OUTER_TITLE: CLASS_SELECT_TREE_OUTER_TITLE,


      /**
       * @inner
       * 多个值之间用于拼接的字符
       * @type {string}
       */
      SEPARATOR_SYMBOL: SEPARATOR_SYMBOL,

      /**
       * @inner
       * 下拉树默认配置项
       * @type {selectTreeOptions}
       */
      LAYUI_SELECT_TREE_OPTIONS: LAYUI_SELECT_TREE_OPTIONS,

      /**
       * @inner
       * 水波纹 INSET 的样式名称
       * @type {string}
       */
      CLASS_WAVE_INSET_RIPPLES: CLASS_WAVE_INSET_RIPPLES,

      /**
       * @inner
       * 水波纹 OUT 的样式名称
       * @type {string}
       */
      CLASS_WAVE_OUT_RIPPLES: CLASS_WAVE_OUT_RIPPLES,

      /**
       * @inner
       * 水波纹 永久动画 的样式片段
       * @type {string}
       */
      CLASS_WAVE_ALWAYS: CLASS_WAVE_ALWAYS,

      /**
       * @inner
       * 水波纹 一次动画 的样式片段
       * @type {string}
       */
      CLASS_WAVE_ONCE: CLASS_WAVE_ONCE,

    },

    /**
     * @inner 是否无需指定元素就可以渲染,默认是false,大多数组件的渲染都需要指定一个dom元素
     */
    isRenderWithoutElem: false,

    /**
     * @inner 渲染是否由事件触发,这里选false,是调用触发的render
     */
    isRenderOnEvent: false,

    /**
     * @inner 组件重载时是否允许深度重载,默认是false,当前的组件还没有涉及重载这个方面
     */
    isDeepReload: false,

    /**
     * @function 组件初始化之前的回调函数
     * @param {*} options 应该是获取到的配置项了
     * @desc 初始化组件的状态，包括表格实例、页码缓存和选项卡索引。
     */
    beforeInit: function (options) {
      this.converters = [];
    },

    /**
     * @function 组件渲染之前的回调函数
     * @desc 可以在此处执行一些预处理逻辑，比如动态调整配置项。
     */
    beforeRender: function () {},

    /**
     * @function 渲染调用方法
     * @see component.config
     * @desc 组件必传属性,在文档和实例里面都是没有入参的,这里使用 {@linkplain component.config this.config获取当前组件的配置项信息}
     */
    render: function(){
      this.initData();
      this.scanForm();
    },

    /**
     * @function 事件处理
     * @see component.config
     * @desc 组件必传属性,在文档和实例里面都是没有入参的,这里使用 {@linkplain component.config this.config获取当前组件的配置项信息}
     *  > 其实相当于我们之前习惯的addListener方法,可以用来添加监听事件
     */
    events: function(){

    },

    /**
     * @function 扩展组件渲染的实例对象的回调函数。
     * @param {Object} that 当前实例对象
     * @desc 可以在此处扩展组件的方法或属性。
     */
    extendsInstance: function (that) {
      var that = this;
      return {
        // 扩展组件的方法
        on: function (events, callback) {
          return that.on(events, callback);
        },
        // 赋值方法
        // val: function(object){
        //   return layui.formplus.val(that.config.id, object);
        // },

      };
    },

  });

  /* 五、扩展方法 */

  /**
   * 扩展组件原型方法
   */
  var Class = component.Class;

  /**
   * @private
   * @method initData
   * 初始化表单映射数据
   * 
   * @this component实例
   */
  Class.prototype.initData = function () {
    this.config.formData = this.observe({target: {}});
  };

  /**
   * @private
   * @method getData
   * 获取表单映射数据 
   * 
   * - 当不传入 `key` 时，返回整个 `formData` 对象的深拷贝。
   * - 当传入 `key` 时：
   *   - 如果 `formData` 中存在该 `key`，则返回对应值的深拷贝（即使值为 `false`, `0`, `''` 等 false 值）。
   *   - 如果 `formData` 中不存在该 `key`，则返回 `null`。
   * 
   * @this component实例
   * 
   * @param {string} [key] - 要获取数据的键名(表单元素的 `name` 属性值)。 如果省略，则返回整个“受管理的”表单数据对象。
   * @returns {*} 请求的数据，或整个表单数据对象的深拷贝，或 `null`（当键不存在时）。
   */
  Class.prototype.getData = function (key) {
    // 1. 如果没有提供 key，返回整个 formData 的深拷贝
    if (key === undefined) {
      return cloneDeep(this.config.formData);
    }
    /**
     * 2. 确保 key 是有效的属性键类型（字符串）
     *    如果不是，可以抛出错误或视为不存在，这里选择视为不存在返回 null
     */
    if(layui.type(key) !== 'string') {
      console.warn(`getData: key must be a string, got ${layui.type(key)}`);
      return null;
    }

    // 3. 尝试从 formData 中获取值
    var value = this.config.formData[key];

    // 4. 如果键存在（即使值为 undefined 以外的任何值，包括 false 值），返回其深拷贝
    //    注意：`in` 操作符或 `hasOwnProperty` 也可以，但直接比较 `undefined` 更高效
    if (value !== undefined) {
      return cloneDeep(value);
    }

    // 5. 键不存在，返回 null
    return null;
  };

  /**
   * @method setData
   * 安全地设置表单数据，支持动态添加新属性。
   * 内部根据环境和属性存在性，选择最优策略。
   * 
   * @this component实例
   */
  Class.prototype.setData = function (key, value) {

    var formData = this.config.formData;
    
    // --- 策略 1: 如果环境支持 Proxy ---
    if(HAS_PROXY) {
      // 如果尚未升级为 Proxy，则进行升级
      if(!formData.__isReactiveProxy){
        // 第一次调用 setData 且支持 Proxy 时，将 formData 转换为 Proxy
        // 这需要一个 createFormDataProxy 函数
        this.config.formData = this.createFormDataProxy(formData, this);
        // 标记为 Proxy，避免重复转换
        this.config.formData.__isReactiveProxy = true;
      }
      // 无论是新升级还是已存在，都通过 Proxy 设置
      this.config.formData[key] = value;
      return;
    }

    // --- 策略 3: 不支持 Proxy 或未升级，使用 Object.defineProperty 模式 ---
    // 检查属性是否已存在
    if (Object.prototype.hasOwnProperty.call(formData, key)) {
      // 已存在：直接赋值，触发现有 setter
      formData[key] = value;
    } else {
      // 不存在：这是添加新属性！必须手动调用 doObserve 确保响应式
      // 这正是原始的场景
      // var o = {};
      // o[key] = value;
      // var proxy = Object.assign(this.config.formData, o);
      // this.config.formData = this.observe({target: proxy});
      this.doObserve.call(this, {
        target: formData,
        value: value, // 初始值
        name: key,
        filter: getFilterNameOfFormItem.call(this, this.config.elem.find(`[name="${escapeSelector(key)}"]`).get(0))
      });
    }
  };

  /**
   * 判断两个值是否相等，支持字符串和字符串数组
   * @param {string|string[]} value 新值
   * @param {string|string[]} oldValue 旧值
   * @returns {boolean} 是否相等
   */
  Class.prototype.isStringOrStringArrayEqual = function (value, oldValue) {
    if(value === undefined || oldValue === undefined){
      return false;
    }

    if(layui.type(value) != layui.type(oldValue)) {
      return false;
    }

    // 如果是字符串
    if (layui.type(value) === 'string' || layui.type(value) === 'boolean' ) {
      return value === oldValue;
    }

    if(value.length != oldValue.length) return false;

    var res = true;
    layui.each(value, (k, v) => {
      if(oldValue[k] != v){
        res = false;
        return true;
      }
    });

    return res;
  },

  /**
   * @method createFormDataProxy
   * 创建一个 Proxy 来拦截 formData 的操作。
   * 
   * @this component实例
   * @param {Object} target - 要代理的原始对象。
   * @param {Object} context - 组件实例上下文 (this)。
   * @return {Proxy} 返回一个 Proxy 实例。
   */
  Class.prototype.createFormDataProxy = function (target, context) {
    var self = context; // 保持清晰的引用
    return new Proxy(target, {
      get(obj, prop) {
        // 拦截读取
        return Reflect.get(obj, prop);
      },
      set(obj, prop, value) {
        var oldValue = obj[prop];

        if(self.isStringOrStringArrayEqual(value, oldValue)) return true;

        // 特殊标志参数处理
        if(prop == '__isReactiveProxy'){
          return Reflect.set(obj, prop, value);
        }
        var $elements = self.config.elem.find(`[name="${escapeSelector(prop)}"]`);
        var formItem = $elements.get(0);
        if (!formItem) {
          // console.warn(`[formplus] No form element found with name="${prop}". Data updated but no event triggered.`);
          return Reflect.set(obj, prop, value);
        }
        var formFilter = getFilterNameOfFormItem.call(self, formItem);
        if (!formFilter) {
          console.warn(`[formplus] No lay-filter found for element with name="${prop}". Event will not be triggered.`);
          return Reflect.set(obj, prop, value);
        }
        // 构建事件数据
        var eventData = {
          elem: formItem,
          value: value,
          oldValue: oldValue,
        };
        // 执行 before 事件 (保持与现有逻辑一致)
        if (layui.event.call(self, component.CONST.MOD_NAME, 
            `beforeExecute-${component.CONST.MOD_ID}-${self.config.id}[${formFilter}]`,eventData) === false) {
          return true; // 拦截
        }

        // 设置值
        var result = Reflect.set(obj, prop, value);

        // 触发更新事件
        layui.event.call(self, component.CONST.MOD_NAME, 
            `${component.CONST.MOD_ID}-${self.config.id}[${formFilter}]`, eventData);

        return result;
      },
    });
  };

  /**
   * @method scanForm
   * 扫描并渲染表单
   * 
   * @this component实例
   * @param {String|null} type    渲染类型: select;radio;checkbox...
   * @description
   *  
   */
  Class.prototype.scanForm = function (type) {
    var self = this;
    var $container = self.config.elem; // 缓存 jQuery 对象
    var formData = self.config.formData;
    var containerDOM = $container.get(0);
    // 首先遍历表单元素
    var fieldElems = $container.find("input,select,textarea");
    Array.prototype.forEach.call(fieldElems, (formItem) => {
      // 检查是 HTMLElement
      if (formItem instanceof HTMLElement) {
        // 检查是否忽略渲染
        if(!shouldIgnoreElement(formItem)) {
          var name = formItem.name;
          // 只处理有name属性的表单元素
          if(name){
            var formType = getFormType(formItem);
            // 判断是否之前就渲染过
            if(!formData.hasOwnProperty(name)) {
              // 初始化 formData
              self.setData(name, formType == "checkbox" ? [] : "");
              
              // 应用渲染器
              applyRenderer(self, formItem, formType, containerDOM);
            } else {
              // 之前有同name的渲染过这里就不记录了，免得重复
            }
          }
        }
      }
    });
    // 添加水波纹按钮
    var waveElems = $container.find(".layui-water-ripples-container");

    layui.each(waveElems, (key, waveItem) => {
      if (waveItem instanceof HTMLElement) {
        // lay-ignore标注后不会对这个进行美化,这里就放弃渲染它
        if (!shouldIgnoreElement(waveItem)) {
          // 调用渲染方法
          wave($(waveItem));
        }
      }
    });
    
  };

  /**
   * @method on
   * 表单事件监听
   * 
   * @this component实例
   * @param {String} events 事件信息，可以直接传表单元素的 name 属性值,也可以将表单元素的 lay-filter 属性值用括号包装
   * @param {Function} callback  回调函数
   * @description
   *  
   */
  Class.prototype.on = function (events, callback) {
    if(layui.type(callback) != 'function') {
      return;
    }

    // 尝试从中提取 lay-filter 属性值
    var eventFilter = parseEventFilter(events);

    // 首先判断是否是定义下拉树特殊事件 (selectTree(abc)格式)
    if(isSelectTree(events) && eventFilter){
      // 特殊绑定事件 - 这里没有对 eventFilter 判空，因为上面的判断已经校验过了
      return layui.onevent.call(this, component.CONST.MOD_NAME, `selectTree(${eventFilter}-[${component.CONST.MOD_ID}-${this.config.id}])`, callback);
    }

    // 尝试从 events 或 DOM 中提取 layFilter
    var layFilter = eventFilter || getFilterNameOfFormItem.call(this,this.config.elem.find(`[name="${escapeSelector(events)}"]`).get(0));

    // 根据 lay-filter 属性值绑定事件
    if(layFilter){
      return layui.onevent.call(this, component.CONST.MOD_NAME, `${component.CONST.MOD_ID}-${this.config.id}[${layFilter}]`, callback);
    }
  };

  /**
   * @method beforeExecute
   * 用于判断，接下来的 on 事件是否触发
   * @private
   * 内部使用，不做检验
   * @param {*} layFilter 
   * @param {*} callback 
   */
  Class.prototype.beforeExecute = function(layFilter, callback){
    return layui.onevent.call(this, component.CONST.MOD_NAME, `beforeExecute-${component.CONST.MOD_ID}-${this.config.id}[${layFilter}]`, callback);
  };

  /**
   * @method beforeExecute
   * 用于触发同步html与proxy的事件
   * @private
   * 内部使用，不做检验
   * @param {*} name 用name方便取值 
   * @param {*} callback 
   */
  Class.prototype.onSyncValue = function(name, callback){
    return layui.onevent.call(this, component.CONST.MOD_NAME, `syncValue-${component.CONST.MOD_ID}-${this.config.id}[${name}]`, callback);
  };

  /**
   * @method cacheTree
   * 缓存/获取 laydate 实例
   * 
   * @this component实例
   * @param {String} treeId laydate 实例的id
   * @param {*} treeInst laydate 实例
   * @returns {*} laydate 实例
   *  
   */
  Class.prototype.cacheTree = function (treeId, treeInst) {
    if(!this.trees) this.trees = {};
    if(treeId && treeInst) this.trees[treeId] = treeInst;
    return this.trees[treeId];
  };

  /**
   * @method registerConverter
   * 注册一个自定义转换器，用于数据输入输出的格式转换。
   * 
   * @this component 实例
   * @param {Function} support 判断是否支持当前 I/O 类型的函数，签名: (inputType, outputType, name) => Boolean
   * @param {Function} convert 转换函数，签名: (value, data, ctx) => any
   * @returns {Object} 当前实例，支持链式调用
   */
  Class.prototype.registerConverter = function (support, convert) {
    this.converters.push(new converter(support, convert));
    return this; // 支持链式调用
  };

  /**
   * @method findConverter
   * 查找匹配的转换器：优先实例级，后全局内置。
   * 
   * @this component 实例
   * @param {*} I 输入数据类型或标识
   * @param {*} O 输出数据类型或标识
   * @param {String} name 字段 name 属性
   * @returns {converter|null} 匹配的转换器实例，未找到返回 null
   */
  Class.prototype.findConverter = function (I, O, name) {
    var self = this;
    var matched = null;

    // 1. 查找实例级转换器
    matched = findConverterInList(self.converters, self, I, O, name);
    if (matched) return matched;

    // 2. 查找全局内置转换器
    matched = findConverterInList(formConverters, self, I, O, name);
    return matched;
  };

  /**
   * @method invokeServiceLocator
   * 调用服务定位器(私有 -> 公共)
   * 
   * @param {String} methodName   方法名称
   * @param {...*} [args] - 任意数量的参数，将传递给对应的服务方法 
   * @this component实例
   * @returns {*} 服务函数的返回值；若服务不存在或非函数，返回 null
   * 
   * @description
   * 执行流程：
   *   1. 从 publicServiceLocator 中查找 methodName 对应的服务
   *   2. 校验服务是否存在且为函数类型（使用 layui.type）
   *   3. 若存在，apply 调用该函数，this 指向当前组件实例，参数为 arguments.slice(1)
   *   4. 若不存在，返回 null（表示调用失败）
   * 
   * 设计意图：
   *   - 实现“命令模式”或“插件式调用”
   *   - 支持在配置中声明服务名，运行时动态执行
   *   - 避免 if-else 或 switch 分发大量服务调用
   * 
   * 边界情况：
   *   - methodName 为空或未注册 → 返回 null
   *   - service 存在但非函数 → 返回 null（防止执行报错）
   *   - 参数可变长，适用于 format、parse、validate 等场景
   * 
   */
  Class.prototype.invokeServiceLocator = function (methodName) {
    /**
     * 从服务定位器中获取服务函数
     */
    var serviceFunction = publicServiceLocator.get(methodName);

    /**
     * 成功获取到对应的方法
     */
    if(serviceFunction && layui.type(serviceFunction) == 'function'){

      /**
       * 调用指定的方法，并将剩余的参数传入
       */
      return serviceFunction.apply(this, Array.from(arguments).slice(1));
    } 

    // 服务不存在或非函数，返回 null 表示调用失败
    return null;

  };

  /**
   * @method findRenderer
   * 查找匹配的渲染器：遍历全局公共渲染器列表，返回第一个满足条件的实例。
   * 
   * 查找逻辑：
   *   1. 按注册顺序遍历 publicRenderers
   *   2. 跳过非 Renderer 实例（容错）
   *   3. 调用 canRender 判断是否匹配
   *   4. 返回第一个匹配项，未找到返回 null
   * 
   * 设计意图：
   *   - 支持插件式扩展渲染能力
   *   - 与实例级渲染器（this.renderers）形成两级查找机制
   *   - 避免硬编码 if-else 分发渲染逻辑
   * 
   * 边界情况：
   *   - publicRenderers 为空 → 返回 null
   *   - 无匹配项 → 返回 null
   *   - 存在非法对象 → 自动跳过
   * 
   * @this component 实例
   * @param {Object} formItem - 表单项配置对象
   * @param {String} type - 字段类型（通常为 formItem.type）
   * @param {String} formType - 表单类型（如 'add', 'edit', 'view'）
   * @returns {Renderer|null} 匹配的渲染器实例，未找到返回 null
   */
  Class.prototype.findRenderer = function (formItem, type, formType) {

    var matched = null;

    layui.each(publicRenderers, function(key, publicRenderer){
      // 容错：确保是 Renderer 实例
      if(publicRenderer instanceof Renderer){
        // 判断能否使用这个 Renderer
        if(publicRenderer.canRender(formItem, type, formType)){
          matched = publicRenderer;
          return true;
        }
      }
    });

    return matched;
  };

  /**
   * @method observe
   * 监视某个对象，使其变为响应式。
   * 此方法会原地修改传入的对象 target。
   * 
   * @this component实例
   * @param {*} o 配置项
   * @param {Object} o.target - 准备监视的数据对象或数组。
   * @param {string} [o.name] - 当前 target 对象的名称（可选，用于调试）。
   * @param {string} [o.filter] - 过滤器名称（可选）。
   * @return {*} 已经被封装监视的对象 `o.target`。
   * 
   */
  Class.prototype.observe = function (o) {
    // 排除空值
    if(!o || !o.target || layui.type(o.target) !== 'object' || layui.type(o.target) !== 'array') {
      return o ? o.target : null;
    }
    var self = this;

    if(layui.type(o.target) == 'array'){
      // 数组的特殊处理
      o.target.__self__ = self;
      o.target.__key__ = o.name;
      o.target.__proto__ = arrayMethods;
      layui.each(o.target, (k, v) => {
        v = self.doObserve.call(self, {
          target: o.target,
          value: v,
          name: k,
          filter: o.filter ? o.filter : k,
        });
      });
    } else {
      // 处理对象
      layui.each(o.target, (k, v) => {
        v = self.doObserve.call(self, {
          target: o.target,
          value: v,
          name: k,
          // 如果 o.filter 存在，则使用它；否则尝试获取表单项的 filter (这里不考虑嵌套)
          filter: getFilterNameOfFormItem.call(self, self.config.elem.find(`[name="${escapeSelector(k)}"]`).get(0))
        });
      });
    }
    // 返回处理好的值
    return o.target;
  };

  /**
   * @method doObserve
   * 为对象的单个属性建立响应式连接。
   * 
   * @this component实例
   * @param {*} o 配置项
   * @param {Object} o.target - 属性被添加的目标对象。
   * @param {*} o.value - 待添加属性的初始值。
   * @param {string|number} o.name - 属性的键名。
   * @param {string} [o.filter] - 过滤器名称。
   * @return {*} 返回 `o.target` 上 `o.name` 属性的初始值（已为响应式）。
   * @description
   * 
   * > 将一个对象转化处理成被当前模块监视的对象,其传入的参数包含下面几项
   *  - target: 属性被添加的目标
   *  - value: 待添加的属性值
   *  - name: 待添加的属性对应目标的key
   *  - key: 当前target对象的唯一标志字符串
   */
  Class.prototype.doObserve = function (o) {
    var self = this;
    // 递归观察初始值，使其也变成响应式
    var reactiveValue = self.observe.call(self, {
      target: o.value,
      name: o.name,
      filter: o.filter
    });

    // 为属性定义 getter 和 setter
    Object.defineProperty(o.target, o.name, {
      configurable: true,
      enumerable: true,
      get() {
        return reactiveValue;
      },
      set(newValue) {
        // 比较新值和旧值（原始值或代理）是否相等，避免不必要的触发
        // 注意：这里是比较 newValue 和 reactiveValue 的“内容”
        // 简化处理：如果引用相等，直接返回（对于原始值有效，对于对象/数组需谨慎，所以这个是忽略对象/数组的）
        // if (newValue === reactiveValue) return;
        
        if(self.isStringOrStringArrayEqual(newValue, reactiveValue)) return;
        
        // 执行 before 事件，允许拦截
        if(layui.event.call(self, component.CONST.MOD_NAME, `beforeExecute-${component.CONST.MOD_ID}-${self.config.id}[${o.filter}]`, { value: newValue ,oldValue: reactiveValue }) !== false ){
          
          // 保存旧值
          var oldValue = reactiveValue;

          // 更新响应式值
          reactiveValue = self.observe.call(self, {
            target: newValue,
            name: o.name,
            filter: o.filter
          });

          /**
           * 构建回调参数
           */
          var eventData = {
            elem: self.config.elem.find(`[${component.CONST.LAYUI_FILTER}="${escapeSelector(o.filter)}"]`).get(0),
            value: reactiveValue,
            oldValue: oldValue
          };
          
          // 触发事件
          layui.event.call(self, component.CONST.MOD_NAME, `${component.CONST.MOD_ID}-${self.config.id}[${o.filter}]`, eventData);
        }
      },
    });
  };

  /* 五、扩展组件 */
  $.extend(component, {

    converter: converter,

    Renderer: Renderer,

    /**
     * @function
     * 扫描并渲染表单
     * 
     * @param {String|null} filter  表单外层容器(class值为layui-form的dom元素)的lay-filter属性值
     * @param {String|null} type    渲染类型: select;radio;checkbox...
     */
    scanForm: function(filter, type){
      /**
       * 1. 获取组件实例
       */
      var that = null;
      var instanceAll = component.getAllInst();
      layui.each(instanceAll, function (key, value) {
        if (!that && value.config.id == filter) {
          that = value;
          /**
           * - layui.each 遍历时,若返回值为true,则不再继续向下遍历
           */
          return true;
        }
      });
      if (!that) return;

      /**
       * 2. 调用实际方法
       */
      that.scanForm(type);
    },

    /**
     * 表单事件监听
     * @param {*} filter   表单外层容器(class值为layui-form的dom元素)的lay-filter属性值
     * @param {*} events   事件信息
     * @param {*} callback 回调函数
     * @returns 
     */
    on: function(filter, events, callback){

      var that = null;
      var instanceAll = component.getAllInst();
      layui.each(instanceAll, function (key, value) {
        if (!that && value.config.id == filter) {
          that = value;
          /**
           * - layui.each 遍历时,若返回值为true,则不再继续向下遍历
           */
          return true;
        }
      });
      if (!that) return;

      that.on(events, callback)

    },

    /**
     * 表单赋值（批量设置字段值）
     * 
     * 根据 filter 查找对应表单实例，并将 object 中的数据赋值到表单字段。
     * 支持自动类型转换（通过 converter），适用于字符串、布尔、数组等类型映射。
     * 
     * 使用场景：
     *   - 表单回显（如编辑页初始化）
     *   - 动态填充数据（如从接口获取后填充）
     *   - 支持跨实例赋值，无需直接持有实例引用
     * 
     * 示例：
     *   formplus.val('form1', { name: '张三', age: 25, married: true });
     * 
     * 设计说明：
     *   - 自动匹配 converter 进行类型转换（如 string → boolean）
     *   - 仅对 formData 中已定义的字段生效，防止非法赋值
     *   - 不触发 converter 时，原始值直接赋值
     * 
     * @param {String} filter - 表单容器的 lay-filter 值（即实例 config.id）
     * @param {Object} object - 待赋值的数据对象，key 为字段名，value 为值
     * @returns {Object|null} 
     * 
     * @throws {Error} 若目标实例存在但无 setData 方法，会抛出 TypeError
     */
    val: function(filter, object){
      if(!filter) return null;
      var that = null;
      var instanceAll = component.getAllInst();
      layui.each(instanceAll, function (key, value) {
        if (!that && value.config.id == filter) {
          that = value;
          /**
           * - layui.each 遍历时,若返回值为true,则不再继续向下遍历
           */
          return true;
        }
      });

      // 实例未找到
      if (!that) return null;

      // TODO 一下，返回统一的下面的方法
      if(!object) return layui.formplus.getValue(filter);
      // 获取缓存的对象
      var formData = that.config.formData;

      layui.each(object, function (k, v){
        /**
         * 获取转换器
         */
        if (Object.prototype.hasOwnProperty.call(formData, k)) {
        // 下面的用法不兼容旧版浏览器  
        // if (Object.hasOwn(formData, k)) {
          var converterInst = that.findConverter(layui.type(v), layui.type(formData[k]), k);
          var setValue = converterInst instanceof converter ? converterInst.convert.call(that, v) : v;
          that.setData(k, setValue);
        }
        
        // if(layui.type(v) == 'array'){
        //   if(layui.type(that.getData(k) == 'array')){
        //     // 数组
        //     that.setData(k, v);
        //   } else {
        //     // split ,
        //     that.setData(k, v.join(component.CONST.SEPARATOR_SYMBOL));
        //   }
        // } else if(layui.type(v) == 'boolean' && layui.type(that.getData(k)) == 'boolean'){
        //   that.setData(k, v);
        // } else if(layui.type(v) == 'string' && layui.type(that.getData(k)) == 'boolean'){
        //   var _v = !!v;
        //   if(v == 'false') {
        //     _v = false;
        //   }
        //   that.setData(k, _v);
        // } else {
        //   that.setData(k, String(v));
        // }
      });

    },

    /**
     * 表单取值（获取字段值）
     * 
     * 根据 filter 查找表单实例，返回指定字段或整个表单的数据。
     * 支持通过 converter 自动转换输出类型（如 boolean → string）。
     * 
     * 使用场景：
     *   - 获取表单提交数据
     *   - 获取单个字段实时值
     *   - 数据校验前预处理
     * 
     * 示例：
     *   formplus.getValue('form1');           // 获取整个表单数据
     *   formplus.getValue('form1', 'name');   // 获取 name 字段值
     * 
     * 设计说明：
     *   - 调用前触发 `syncValue` 事件，确保数据同步（如富文本编辑器）
     *   - 自动通过 converter 转换输出类型
     *   - 过滤内部字段（如 '-limit' 结尾的）
     *   - 与 layui.form.val 行为保持一致性
     * 
     * @param {String} filter - 表单容器的 lay-filter 值（即实例 config.id）
     * @param {String} [key]  - 可选，指定字段名。若不传，返回整个表单数据
     * @returns {any|Object|null} 
     *          - 若 key 存在：返回该字段的值（经 converter 转换）
     *          - 若 key 不存在：返回整个表单数据对象（经 converter 转换）
     *          - 若实例未找到：返回 null
     * 
     * @throws {Error} 若目标实例存在但无 getData 方法，会抛出 TypeError
     */
    getValue: function(filter, key){
      if(!filter) return null;
      var that = null;
      var instanceAll = component.getAllInst();
      layui.each(instanceAll, function (key, value) {
        if (!that && value.config.id == filter) {
          that = value;
          /**
           * - layui.each 遍历时,若返回值为true,则不再继续向下遍历
           */
          return true;
        }
      });
      if (!that) return null;

      // 触发数据同步事件，确保数据最新
      if(key) {
        // 执行数据同步校验
        layui.event.call(that, component.CONST.MOD_NAME, `syncValue-${component.CONST.MOD_ID}-${that.config.id}[${key}]`, {});
        var result = that.getData(key);
        var I = layui.type(result);
        var converterInst = that.findConverter(I, 'boolean' === I ? I : 'string', key);
        return converterInst instanceof converter ? converterInst.convert.call(that, result) : result;
      }

      // 执行数据同步校验
      layui.each(that.config.formData, function(k){
        layui.event.call(that, component.CONST.MOD_NAME, `syncValue-${component.CONST.MOD_ID}-${that.config.id}[${k}]`, {});
      });

      var result = that.getData();
      var resProxy = {};
      layui.each(result, function(k, v){
        if(k.indexOf('-limit') < 0 && k != '__isReactiveProxy') {
          var I = layui.type(v);
          var converterInst = that.findConverter(I, 'boolean' === I ? I : 'string', k);
          var setValue = converterInst instanceof converter ? converterInst.convert.call(that, v) : v;
          resProxy[k] = setValue;
        }
      });

      return resProxy;
    },

    /**
     * 添加按钮水波纹效果
     * 
     * 为指定 DOM 元素添加 Material Design 风格的点击水波纹动画。
     * 封装了底层 `wave` 函数，提供统一调用入口。
     * 
     * 使用场景：
     *   - 按钮点击反馈
     *   - 自定义组件增强交互体验
     * 
     * 
     * @param {String|HTMLElement|JQuery} destination - 目标元素选择器或 DOM 对象
     * @param {Object} [option] - 水波纹配置项
     * 
     */
    wave: function(destination, option = {}){
      return wave(destination, option);
    },

    /**
     * 配置节假日数据
     * 
     * 动态注册节假日或工作日信息，用于日历、排班、审批等场景的日期判断。
     * 
     * 编码规则（内部字符串格式）：
     *   - 格式：`起始日期(8位) + 规则序号(1位) + 状态码(1位) + 结束日期(8位)`
     *   - 状态码：0 = 工作日，1 = 节假日
     *   - 示例：`202501011020250103` 表示 2025-01-01 到 2025-01-03 为节假日
     * 
     * 使用场景：
     *   - 动态加载节假日配置（如从接口获取）
     *   - 临时调整排班规则
     *   - 插件化扩展日历功能
     * 
     * 
     * @param {String} destination - 起始日期，格式：YYYYMMDD（8位数字）
     * @param {String} holiday     - 结束日期，格式：YYYYMMDD（8位数字）
     * @param {Number|String} order - 规则序号（1位数字），用于区分不同规则批次
     * @param {Boolean} work        - 是否为工作日（true=工作日，false=节假日）
     * @returns {void|String} 若操作成功，返回更新后的密钥字符串；否则返回 undefined
     * 
     * @throws {Error} 若 HolidayUtil 未加载，方法静默失败，无异常抛出
     */
    addHoliday: function(destination, holiday, order, work){
      if(!window.HolidayUtil) return;
      // 参数校验 如果为18位数,就当是悟透了规则的,直接加入
      if(/^[0-9]{18}/.test(destination)) return HolidayUtil.setKey(HolidayUtil.getKey() + destination);
      // 参数校验 destination 和 holiday 参数应该是一个8位数字 order 参数应该是一个数字
      var paramFlag = /^[0-9]{8}/.test(destination) && /^[0-9]{8}/.test(holiday) && /^[0-9]{1}/.test(order);
      if(paramFlag) {
        var str = destination + order + (work ? 0 : 1 ) + holiday;
        return HolidayUtil.setKey(HolidayUtil.getKey() + str);
      }
    },

    /**
     * 获取缓存的 tree 实例
     * @param {*} filter 
     * @param {*} treeId 
     * @param {*} treeInst 
     * @returns 
     */
    cacheTree: function(filter, treeId, treeInst){
      if(!filter) return null;
      var that = null;
      var instanceAll = component.getAllInst();
      layui.each(instanceAll, function (key, value) {
        if (!that && value.config.id == filter) {
          that = value;
          /**
           * - layui.each 遍历时,若返回值为true,则不再继续向下遍历
           */
          return true;
        }
      });
      if (!that) return;
      return that.cacheTree(treeId, treeInst);
    },

    /**
     * 注册一个转换器到指定组件实例
     * 
     * 根据 filter（实例 ID）查找对应组件实例，并在其上注册转换器。
     * 
     * 使用场景：
     *   - 动态为某个表单实例注册自定义数据转换逻辑（如：金额格式化、日期解析）
     *   - 插件化扩展，无需直接持有实例引用
     * 
     * 示例：
     *   registerConverter('form1', 
     *     (I, O) => I === 'string' && O === 'number',
     *     (val) => parseFloat(val) || 0
     *   );
     * 
     * 设计说明：
     *   - 支持运行时动态注入 converter，提升灵活性
     *   - 与实例级 registerConverter 方法形成间接调用链
     *   - 查找失败时返回 null，不抛错，由调用方决定如何处理
     * 
     * @param {String} filter - 目标组件实例的唯一标识符（config.id）
     * @param {Function} support - 条件函数，判断是否适用当前 I/O 类型
     *                            签名: (inputType, outputType, name) => Boolean
     * @param {Function} convert - 转换函数，执行实际转换逻辑
     *                            签名: (value, data, ctx) => any
     * @returns {Object|null} 返回目标实例（支持链式调用），若实例未找到则返回 null
     * 
     * @throws {Error} 若目标实例存在但无 registerConverter 方法，会抛出 TypeError（由 apply 抛出）
     */
    registerConverter: function(filter, support, convert){
      // filter 为空，直接返回 null
      if(!filter) return null;
      var that = null;
      var instanceAll = component.getAllInst();
      layui.each(instanceAll, function (key, value) {
        if (!that && value.config.id == filter) {
          that = value;
          /**
           * - layui.each 遍历时,若返回值为true,则不再继续向下遍历
           */
          return true;
        }
      });

      // 未找到匹配实例，返回 null
      if (!that) return;

      // 调用目标实例的 registerConverter 方法
      return that.registerConverter(support, convert);
    },

    /**
     * 注册一个可被动态调用的服务
     * 
     * 封装对 publicServiceLocator 的访问，提供统一入口。
     * 
     * 优势：
     *   - 隐藏底层实现（publicServiceLocator）
     *   - 后续可添加校验、日志、拦截等逻辑
     *   - 保持 API 一致性
     * 
     * 示例：
     *   registerHandler('formatDate', function(value) { ... });
     * 
     * @param {String} methodName - 服务名称，将作为 invokeServiceLocator 的第一个参数
     * @param {Function} service - 服务函数，接收 invoke 时传入的参数
     * @returns {Object} publicServiceLocator 实例，支持链式注册（如 register(...).register(...)）
     */
    registerHandler: function(methodName, service){
      return publicServiceLocator.register(methodName, service);
    },

    /**
     * 注册一个全局公共渲染器
     * 
     * 用于扩展组件的默认渲染能力，无需实例化即可生效。
     * 
     * 使用场景：
     *   - 自定义通用表单项（如：身份证、手机号、富文本）
     *   - 替换内置渲染逻辑
     *   - 实现插件化扩展
     * 
     * 示例：
     *   registerRenderer(
     *     (item, type, formType) => item.type === 'custom-input',
     *     (dom, item, proxy) => dom.innerHTML = '自定义输入框'
     *   );
     * 
     * @param {Function} condition - 条件函数，返回 true 表示当前渲染器可处理该字段
     *                              签名: (formItem, type, formType) => Boolean
     * @param {Function} render - 渲染函数，执行实际 DOM 渲染
     *                           签名: (containerDOM, formItem, formProxy) => void
     * @returns {void}
     */
    registerRenderer: function(condition, render){
      publicRenderers.push(new Renderer(condition, render));
    }

  });

  /**   数组对象特殊处理 -- start ---   */
  /**
   * <p style = "color: #ff5722;" >warning:下面是一段互联网上面特殊处理数组的方法,其目的是让数组型数据也能被当前模块监视</p>
   */
  var arrayProto = Array.prototype;
  var arrayMethods = Object.create(arrayProto);
  var methodsToPatch = [
    "push",
    "pop",
    "shift",
    "unshift",
    "splice",
    "sort",
    "reverse",
  ];
  methodsToPatch.forEach(function (method) {
    var original = arrayProto[method];
    Object.defineProperty(arrayMethods, method, {
      value: function () {
        var formProxy = this.__self__;
        if (!formProxy) return original.apply(this, arguments);
        var key = this.__key__;
        // 深拷贝
        var proxy = cloneDeep(this);
        // 执行操作后
        original.apply(proxy, arguments);
        // 再全部替换原值，这样可以操作过程中的多次变动造成的影响
        var param = {};
        param[key] = proxy;

        return layui.formplus.val(formProxy.config.id, param);
        // return formProxy.val(formProxy.config.id, param);
      },
      enumerable: !!0,
      writable: true,
      configurable: true,
    });
  });
  /**   数组对象特殊处理 -- end ---   */

  /**   render 方法特殊处理 -- start ---   */

  /**
   * 保存原始的 render 方法
   */
  var componentRender = component.render;

  /**
   * 保存原始的表单(layui.form) render 方法
   */
  var formRender = layui.form.render;

  /**
   * @function
   * 重写 component.render 方法，实现 formplus 实例的自动生命周期管理
   *
   * 设计目标：
   *   - 在 layui 原生 render 基础上，自动绑定/重建 formplus 组件实例
   *   - 支持按 filter 精准渲染，也支持全局批量渲染
   *   - 当表单 DOM 重新渲染后，自动检测并重建实例，避免状态丢失
   *
   * 执行流程：
   *   1. 若未指定 filter：遍历所有 .layui-form 元素，逐个 doRender
   *   2. 若指定 filter：直接 doRender 该表单
   *   3. 最终调用 layui.form.render 执行原生渲染
   *
   * @param {String|null} [type]   - 渲染类型：select、radio、checkbox 等，null 表示全部
   * @param {String|null} [filter] - 表单容器的 lay-filter 值，null 表示所有表单
   */
  component.render = function(type, filter){
    /**
     * 通过参数 filter 判断是否要渲染全部表单 
     */
    if(!filter){
      // 渲染全部，是当前的全部
      document.querySelectorAll(`.${component.CONST.CLASS_FORM}`).forEach((ele) => {
        // 类型判断，防止遍历到不好的内容
        if (ele instanceof HTMLElement) {
          // 获取这个表单的 lay-filter 属性值
          var id = getFilterNameOfForm(ele);
          component.doRender(type, id);
        }
      });
    } else {
      component.doRender(type, filter);
    }

    // 调用原生 layui 表单渲染
    formRender.call(layui.form, type, filter);
  };

  /**
   * @function
   * 执行 formplus 表单实例的渲染与实例管理
   *
   * 核心职责：
   *   - 根据 filter 查找实例
   *   - 若实例不存在：创建新实例
   *   - 若实例存在但 DOM 已移除：销毁并重建实例
   *   - 最终执行 scanForm 完成数据绑定与转换器应用
   *
   * @param {String|null} type    - 渲染类型（传递给 scanForm）
   * @param {String}      filter  - 表单 lay-filter 值
   */
  component.doRender = function(type, filter){
    /**
     * 首先通过 filter 获取实例对象
     */
    var inst = component.getInst(filter);
    if(!inst){
      // 实例不存在，就创建这个实例对象
      componentRender({
        id: filter,
        elem: `.${component.CONST.CLASS_FORM}[${component.CONST.LAYUI_FILTER}="${filter}"]`,
      });
    } else {
      // 判断当前实例对应的表单 elem 是否还在 document 树上
      var existFlag = inst && inst.config && inst.config.elem && !document.contains(inst.config.elem.get(0));
      if(existFlag){
        // 销毁实例
        component.removeInst(filter);
        // 重新创建实例对象
        componentRender({
          id: filter,
          elem: `.${component.CONST.CLASS_FORM}[${component.CONST.LAYUI_FILTER}]="${filter}"]`
        });
      }
    }
    /**
     * 上面的操作后应该可以有一个实例了，此时调用方法重新渲染这个表单
     * 这个扫描表单 scanForm 方法才是组件里面最终的渲染的方法
     */
    // component.scanForm(filter, type);
  };

  /**   render 方法特殊处理 -- end ---   */

  exports(component.CONST.MOD_NAME, component);
});
