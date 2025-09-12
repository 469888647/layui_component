/**
 * https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Audio_API
 *
 * effectChange  声效切换事件
 * setVolume     音量切换回调事件
 * playEnd       播放结束事件
 * playStart     成功开始播放
 * playing       播放中
 * analy         分析中
 * suspend       暂停播放
 * resume        恢复播放
 *
 */
("use strict");
layui.define(["jquery", "form"], function (exports) {

  const MOD_NAME = 'music';

  /**
   * 定义一系列的公共常量
   * @namespace  公共常量
   * @constant
   */
  const GLOBAL_CONSTANT= {
    /**
     * @inner {*} 音频上下文
     */
    CONTEXT: {
      /**
       * @inner {*} 阻塞状态
       */
      CONTEXT_SUSPENDED_STATE:'suspended',
      /**
       * @inner {*} 运行状态
       */
      CONTEXT_RUNNING_STATE:'running',
      /**
       * @inner {*} 关闭状态
       */
      CONTEXT_CLOSED_STATE:'closed',
    },
    /**
     * @inner {*} 播放状态
     */
    PLAY_STATE: {
      /**
       * @inner {*} 就绪状态
       */
      READY:'ready',
      /**
       * @inner {*} 播放前就绪状态
       */
      PREPARE:'prepare',
      /**
       * @inner {*} 播放状态
       */
      PLAYING:'playing',
      /**
       * @inner {*} 暂停状态
       */
      SUSPENDED:'suspended',
      /**
       * @inner {*} 结束状态
       */
      STOP:'stop',
    },
    /**
     * @inner {*} 内置声效
     */
    SOUND_EFFECT: {
      /**
       * @inner {*} 无声效
       */
      NONE:'none',
      /**
       * @inner {*} 混响
       */
      DELAY:'delay',
      /**
       * @inner {*} 立体声
       */
      PANNER:'panner',
    },
    /**
     * @inner {*} layui页面相关
     */
    LAYUI: {
      /**
       * @inner {Number} 全局计数
       */
      INTERNAL_INDEX: 0,
      /**
       * @inner {String} layui里面过滤属性的名称
       */
      LAYUI_FILTER: 'lay-filter',
    }
  };

  /**
   * 获取浏览器音频上下文
   */
  function getAudioContext(){
    /**
     *  判断浏览器是否支持   普通  ||  谷歌  || 火狐
     */
    window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;
    return !window.AudioContext ? null : new AudioContext();
  };

  /**
   * 获取当前传入dom的lay-filter的属性值,没有成功获取就生成一个
   * @param {HTMLElement} item 传入dom
   * @returns {string|*|string} lay-filter的属性值
   */
  function getContextFilter(item) {
    if(!item) return "layui-music" + GLOBAL_CONSTANT.LAYUI.INTERNAL_INDEX ++ ;
    let filter = item.getAttribute(GLOBAL_CONSTANT.LAYUI.LAYUI_FILTER);
    if (!filter) {
      filter = "layui-music" + GLOBAL_CONSTANT.LAYUI.INTERNAL_INDEX ++ ;
      item.setAttribute(GLOBAL_CONSTANT.LAYUI.LAYUI_FILTER, filter);
    }
    return filter;
  };

  /**
   * 动画相关
   * @namespace
   */
  let animate = {

    /**
     * @inner 获取动画帧
     * @param fn
     * @returns {number}
     */
    requestAnimationFrame: function (fn){
      /**
       * 判断浏览器是否支持帧动画函数  普通 || 谷歌 || 火狐
       */
      window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
      if(window.requestAnimationFrame){
        return window.requestAnimationFrame(fn);
      }
      /**
       * 兼容IE
       */
      return setTimeout(fn, 1000 / 60);
    },

    /**
     * @inner 清除动画帧
     * @param id
     */
    cancelAnimationFrame: function (id){
      /**
       * 判断浏览器是否支持取消帧动画函数  普通 || 谷歌 || 火狐
       */
      window.cancelAnimationFrame =  window.cancelAnimationFrame || window.webkitCancelAnimationFrame|| window.webkitCancelRequestAnimationFrame || window.mozCancelAnimationFrame;
      if(window.cancelAnimationFrame){
        return window.cancelAnimationFrame(id);
      }
      /**
       * 兼容IE
       */
      return clearTimeout(id);
    },

  };

  /**
   * @constructor  音频实例对象
   * @param {*} options 配置项
   * @returns {musicProxy} musicProxy实例对象
   * @desc
   *    <p style = "color: #16b777;text-indent: 10px;">音频实例对象说明</p>
   *    <ul>
   *      <li style = "color: #ff5722;">页面上的audio标签不是限1的,故这个模块(music)也应该设计成多个实例</li>
   *      <li>多个实例应该互不影响,但是也不建议无休止的生成实例对象</li>
   *      <li>调用方法可以设置的配置项options有这些:
   *         <ol>
   *          <li>musicProxy.$data - 这个是一个object对象,它以表单的name为key;表单的值为value</li>
   *          <li>musicProxy.$watch - 这个方法可以添加事件监听</li>
   *          <li>musicProxy.$destroy - 销毁这个表单实例对象</li>
   *        </ol>
   *      </li>
   *      <li>实例对象提供的方法有这些:
   *        <ol>
   *          <li>musicProxy.play - 核心方法,用来播放一段音频资源</li>
   *          <li>musicProxy.$watch - 这个方法可以添加事件监听</li>
   *          <li>musicProxy.$destroy - 销毁这个表单实例对象</li>
   *        </ol>
   *      </li>
   *    </ul>
   */
  let musicProxy = function (options){
    return new musicProxy.fn.newInstance(options);
  };

  musicProxy.prototype = musicProxy.fn ={

    /**
     * 创建{@linkplain musicProxy 音频实例对象}
     * @param options 配置项
     * @returns {musicProxy} musicProxy实例对象
     */
    newInstance: function (options) {
      // 初始化上下文
      this.initAudioContext();
      this.initConfig(options);
      return this;
    },

    /**
     * @inner 添加监听事件
     * @param {String} type 事件监听类型
     * @param {Function} callback 事件回调函数
     */
    on: function (type, callback){
      return layui.onevent.call(this, MOD_NAME + '-' + this.id, type, callback);
    },

    /**
     * @inner 将秒数切换成分秒的字符串
     * @param seconds  秒数
     * @returns {string}
     */
    convertSeconds: function(seconds) {
      seconds = parseInt(seconds);
      var minutes = Math.floor(seconds / 60);
      var remainingSeconds = seconds % 60;
      if(minutes < 10) minutes = '0' + minutes;
      if(remainingSeconds < 10) remainingSeconds = '0' + remainingSeconds;
      return  minutes + ":" + remainingSeconds;
    },

    /**
     * @inner 初始化{@linkplain musicProxy 音频实例}的音频上下文
     */
    initAudioContext: function(){
      if(!this.audioContext) this.audioContext = getAudioContext();
    },

    /**
     * @inner 获取当前{@linkplain musicProxy 音频实例}的音频上下文
     * @returns {null|AudioContext|*}
     */
    getAudioContext: function(flag){
      if(!this.audioContext) this.initAudioContext();
      if(!this.audioContext) return null;
      /**
       * context已经被销毁需要重新创建一个context
       */
      if(this.audioContext.state == GLOBAL_CONSTANT.CONTEXT.CONTEXT_CLOSED_STATE){
        this.audioContext = null;
        this.initAudioContext();
        if(!this.audioContext) return null;
      }
      /**
       * context被阻塞需要恢复context
       */
      if(this.audioContext.state == GLOBAL_CONSTANT.CONTEXT.CONTEXT_SUSPENDED_STATE){
        // 添加一个判断,如果是播放受阻的,不给予恢复
        if(GLOBAL_CONSTANT.PLAY_STATE.SUSPENDED != this.playState)
          this.audioContext.resume();
      }
      return this.audioContext;
    },

    /**
     * @inner 初始化{@linkplain musicProxy 音频实例}的配置信息
     * @param options 配置项
     */
    initConfig: function(options = {}){

      // 滑块的最大值,这个关系到播放条的配置
      this.sliderTotal = options.sliderTotal || 500;

      // 初始化页面的id或者dom
      this.id = options.id;
      this.elem = null;
      if(options.elem){
        this.elem = $(options.elem);
        if(!this.id) this.id = getContextFilter(this.elem.get(0));
        // 绑定dom事件
        if(this.elem.length == 1) this.initElement();
      }

      /**
       * 播放状态
       * @type {string}
       */
      this.playState = GLOBAL_CONSTANT.PLAY_STATE.READY;
      this.lastPlayState = GLOBAL_CONSTANT.PLAY_STATE.READY;
      /**
       * 播放循环
       * @type {boolean}
       */
      this.playLoop = options.loop || false;
      /**
       * 播放倍速
       * @type {Number}
       */
      this.playSpeed = options.speed || 1;

      /**
       * 混响延时时间
       * @type {number}
       */
      this.delayTimeValue = 0.05;

      /**
       * 创建音频节点
       */
      this.initSourceNode()

      /**
       * 设置声效
       */
      this.changeSoundEffect(options.effect || GLOBAL_CONSTANT.SOUND_EFFECT.NONE);

      /**
       * 设置主声音
       */
      this.setVolume(options.volume || 1);

    },

    /**
     * @inner 初始化指定的dom区域
     */
    initElement: function(){
      let self = this;
      let playIcon = 'layui-icon-play';
      let stopIcon = 'layui-icon-pause';
      let noneVoiceIcon = 'layui-icon-mute';
      let voiceIcon = 'layui-icon-speaker';
      let playBar = 'layui-music-play-bar';
      let gainBar = 'layui-music-gain-bar';
      let canvasArea = 'layui-music-canvas-area';
      //初始化为停止状态
      self.elem.find('.' + stopIcon).removeClass(stopIcon).addClass(playIcon);
      //初始化喇叭状态
      if(self.volume == 0){
        // 图标换成静音状态
        self.elem.find('.' + voiceIcon).removeClass(voiceIcon).addClass(noneVoiceIcon);
      }else{
        self.elem.find('.' + noneVoiceIcon).removeClass(noneVoiceIcon).addClass(voiceIcon);
      }
      // 添加点击事件
      self.elem.on('click', '.' + playIcon, function (){
        // 点击播放/恢复
        if(self.playState == GLOBAL_CONSTANT.PLAY_STATE.SUSPENDED){
          self.resume();
        } else {
          self.play();
        }
      });
      self.elem.on('click', '.' + stopIcon, function (){
        // 点击暂停
        self.suspend();
      });
      self.elem.on('click', '.' + voiceIcon, function (){
        // 设置静音为0
        self.setVolume(0);
      });
      self.elem.on('click', '.' + noneVoiceIcon, function (){
        // 设置默认为1
        self.setVolume(1);
      });

      // 添加切换开始播放的监听事件 - 切换成结束的图标
      self.on('playStart', function(){
        self.elem.find('.' + playIcon).removeClass(playIcon).addClass(stopIcon);
      });
      // 添加切换继续播放的监听事件 - 切换成结束的图标
      self.on('resume', function(){
        self.elem.find('.' + playIcon).removeClass(playIcon).addClass(stopIcon);
      });
      // 添加切换结束播放的监听事件 - 切换成开始的图标
      self.on('playEnd', function(){
        self.elem.find('.' + stopIcon).removeClass(stopIcon).addClass(playIcon);
      });
      // 添加切换暂停播放的监听事件 - 切换成开始的图标
      self.on('suspend', function(){
        self.elem.find('.' + stopIcon).removeClass(stopIcon).addClass(playIcon);
      });
      // 添加修改声音时,修改喇叭的图标
      self.on('setVolume', function(){
        if(self.volume == 0){
          // 图标换成静音状态
          self.elem.find('.' + voiceIcon).removeClass(voiceIcon).addClass(noneVoiceIcon);
        }else{
          self.elem.find('.' + noneVoiceIcon).removeClass(noneVoiceIcon).addClass(voiceIcon);
        }
      });
      // 播放条
      if(self.elem.find('.' + playBar).length > 0){
        layui.use('slider', function(){
          let controlFlag = true;
          let playBarInst = layui.slider.render({
            elem: self.elem.find('.' + playBar),
            max: self.sliderTotal,
            setTips: function(value){ // 自定义提示文本
              if(!self.duration) return '';
              if(controlFlag){
                return self.convertSeconds(self.currentTime) + '/' + self.convertSeconds(self.duration);
              }else{
                return self.convertSeconds(parseInt(value / self.sliderTotal * self.duration)) + '/' + self.convertSeconds(self.duration);
              }
            },
            // change: function(value){
            //   controlFlag = false;
            // },
            done: function(value){
              if(controlFlag == false && self.buffer){
                self.playBuffer(null, parseInt(value / self.sliderTotal * self.duration));
              }
              // controlFlag = true;
              // self.playBuffer(null, self.currentTime);
            },
          });
          // 不能直接给播放条的回调函数中做setValue时也会触发
          self.elem.on('mousedown', '.layui-slider-wrap-btn', function(){
            controlFlag = false;
          });
          $('body').on('mouseup', function(){
            if(controlFlag == false){
              controlFlag = true;
              // self.playBuffer(null, parseInt(playBarInst.value / 100 * self.duration));
            }
          });
          // 添加切换结束播放的监听事件 - 切换成最早的值
          // self.on('playEnd', function(){
          //   if(controlFlag) playBarInst.setValue(0);
          // });
          self.on('playStart', function(){
            if(controlFlag) playBarInst.setValue(self.proccess * self.sliderTotal);
          });
          // 添加播放中的监听事件
          self.on('playing', function(){
            if(controlFlag){
              playBarInst.setValue(self.proccess * self.sliderTotal);
            }
          });
        });
      }
      // 声音条
      if(self.elem.find('.' + gainBar).length > 0){
        layui.use('slider', function(){
          let gainBarInst = layui.slider.render({
            elem: self.elem.find('.' + gainBar),
            type: "vertical",
            value: self.volume * 100,
            min: 0,
            max: 200,
            setTips: function(value){ // 自定义提示文本
              return Number(value / 100).toFixed(2);
            },
            done: function(value){
              if(value != parseInt(self.volume * 100)) self.setVolume(parseFloat(value / 100));
            },
          });
          self.on('setVolume', function(){
            gainBarInst.setValue(parseInt(self.volume * 100));
          });
        });
      }
      // canvas动画 canvasArea
      if(self.elem.find('.' + canvasArea).length == 1){
        let area = self.elem.find('.' + canvasArea);
        let canvas = document.createElement('canvas');
        area.append($(canvas));
        canvas.style.width = area.width();
        canvas.style.height = area.height();
        canvas.width = area.width();
        canvas.height = area.height();
        let canvasContext = canvas.getContext('2d');
        // let gradient = canvasContext.createLinearGradient(0, 0, 0, 300);
        // gradient.addColorStop(1, '#0f00f0');
        // gradient.addColorStop(0.5, '#ff0ff0');
        // gradient.addColorStop(0, '#f00f00');
        // canvasContext.fillStyle = gradient ;
        let styles = getComputedStyle(document.documentElement);
        var variableValue = styles.getPropertyValue('--lay-framework-main-bgColor') || '30, 159, 255';
        canvasContext.fillStyle = "rgba(" + variableValue + ",1)";
        // canvasContext.fillRect(0, 0, canvas.width, canvas.height);
        let cwidth = canvas.width;
        let cheight = canvas.height - 2;
        let rectangleWidth = 5;
        let rectangleGap = 2;
        let rectangleTotal = cwidth / (rectangleWidth + rectangleGap);
        let minHeight = 2;
        let cacheResouce = null;
        // 添加绘图事件
        self.on('analy', function(){
          draw(self.analyArray);
          cacheResouce = self.analyArray;
        });
        self.on('playEnd', function(){
          reduce();
        });
        self.on('suspend', function(){
          reduce();
        });
        // 绘制图形
        function draw(array){
          let step = Math.round(array.length / rectangleTotal);
          canvasContext.clearRect(0,0,cwidth,cheight);
          for(let i = 0; i< rectangleTotal; i++){
            let value = array[i * step];
            canvasContext.fillRect(i * (rectangleWidth+rectangleGap) , cheight - value , rectangleWidth , value||minHeight);
          }
        };
        // 逐渐消失
        function reduce(){
          let flag = false;
          layui.each(cacheResouce, function (k, v){
            if(v > 0){
              cacheResouce[k] = v - 10 < 0 ? 0 : v - 10;
              flag = true;
            }
          });
          if(flag && self.playState != GLOBAL_CONSTANT.PLAY_STATE.PLAYING){
            draw(cacheResouce);
            animate.requestAnimationFrame(reduce);
          }
        }
      }
    },

    /**
     * @inner 初始化使用的音频节点对象
     */
    initSourceNode: function(){
      // 初始化音频分析节点
      this.initAnalyser();
      // 初始化混响音频节点
      this.initReverberation();
      // 初始化立体声音频节点
      this.initPanner();
      // 初始化主声音音频增益节点
      this.initGain();
    },

    /**
     * @inner 播放音频
     * @param source {File|AudioBuffer|String}音频配置项
     * @param start {Number} 开始播放的秒数
     */
    play: function(source, start){
      if(source instanceof File) return this.playFile(source, start);
      if(typeof source === 'string') return this.playUri(source, start)
      // if(source instanceof AudioBuffer)
      return this.playBuffer(source, start);
    },

    /**
     * @inner 停止播放
     */
    stop: function(){
      this.interrupt();
    },

    /**
     * @inner 暂停播放
     */
    suspend: function(){
      if(this.playState == GLOBAL_CONSTANT.PLAY_STATE.PLAYING){
        this.getAudioContext().suspend();
        this.playState = GLOBAL_CONSTANT.PLAY_STATE.SUSPENDED;
      }
      layui.event.call(this, MOD_NAME + '-' + this.id, 'suspend', {});
    },

    /**
     * @inner 恢复播放
     */
    resume: function(){
      this.getAudioContext().resume();
      this.playState = this.lastPlayState;
      layui.event.call(this, MOD_NAME + '-' + this.id, 'resume', {});
    },

    /**
     * @inner 播放音频文件
     * @param file {File} 音频文件对象
     * @param start {Number} 开始播放的秒数
     */
    playFile: function(file, start){
      let self = this;
      let fileReader = new FileReader();
      fileReader.onload = function(e){
        let fileResult = e.target.result;
        self.getAudioContext().decodeAudioData(fileResult,function(buffer){
          self.playBuffer(buffer, start);
        },function(e){"Error with decoding audio data" + e.err});
      };
      fileReader.onerror = function(){
        console.warn('解析文件出错!',e);
      };
      fileReader.readAsArrayBuffer(file);
    },

    /**
     * @inner 通过播放音频地址播放音频
     * @param uri {String} 音频资源地址
     * @param start {Number} 开始播放的秒数
     */
    playUri: function(uri, start){
      let self = this;
      let request = new XMLHttpRequest();
      request.open('GET', uri, true);
      request.responseType = 'arraybuffer';
      request.onload = function(){
        let audioData = request.response;
        self.getContext().decodeAudioData(audioData,function(buffer){
          self.playBuffer(buffer, start);
        },function(e){"Error with decoding audio data" + e.err});
      }
      request.send();
    },

    /**
     * @inner 播放音频流
     * @param buffer {AudioBuffer} 音频资源地址
     * @param start {Number} 开始播放的秒数
     */
    playBuffer: function (buffer, start = 0){
      let self = this;
      if(!buffer && !self.buffer) return;
      /**
       * 停止并清除原有的音频节点
       */
      if(self.bufferedSourceNode) self.interrupt();
      // 切换播放状态为准备播放(先切换成这个状态,以确保受阻的上下文可以恢复)
      self.playState = GLOBAL_CONSTANT.PLAY_STATE.PREPARE;
      self.lastPlayState = GLOBAL_CONSTANT.PLAY_STATE.PREPARE;
      /**
       * 创建一个音频节点
       * @type {AudioBufferSourceNode}
       */
      self.bufferedSourceNode = self.getAudioContext().createBufferSource();
      /**
       * 设置音频流
       * @type {AudioBuffer}
       */
      if(buffer){
        self.buffer = buffer;
      } else {
        buffer = self.buffer;
      }
      // 设置流
      self.bufferedSourceNode.buffer = self.buffer;
      self.duration = self.buffer.duration;
      // 设置循环
      // self.switchLoop(self.playLoop);
      // 设置倍速
      self.changePlaySpeed(self.playSpeed);
      // 设置播放结束事件
      self.bufferedSourceNode.onended = function(){
        // 移除定时任务,这里不清除,因为可能是执行前后的关系,这个后执行会影响下一次播放
        // self.analyingIndex && animate.cancelAnimationFrame(self.analyingIndex);
        // self.proccessIndex && clearTimeout(self.proccessIndex);
        // 切换播放状态为结束状态
        // self.playState = GLOBAL_CONSTANT.PLAY_STATE.STOP;
        // self.lastPlayState = GLOBAL_CONSTANT.PLAY_STATE.STOP;
        // 清除音频节点,这里不清除,因为可能是执行前后的关系,这个后执行会以外的释放新创建的下一个音频节点
        // self.bufferedSourceNode = null;
        // 执行播放结束的回调函数
        if(this == self.bufferedSourceNode){
          self.interrupt();
          // 判断是否是循环播放,如果是就循环播放一下
          if(self.playLoop) self.playBuffer();
        }
      }
      // 连接下一个音频节点
      self.connectAnalyser(self.bufferedSourceNode);
      // 播放音频节点
      self.bufferedSourceNode.start(0, start);
      // 设置当前节点的初始播放时间节点
      self.playCurrentTime = start;
      // 调用播放回调,播放动画
      self.playCallBack();
    },

    /**
     * @inner 打断并清除当前实例音频节点
     */
    interrupt: function (){
      if(this.bufferedSourceNode){
        // 修改播放状态
        this.playState = GLOBAL_CONSTANT.PLAY_STATE.STOP;
        this.lastPlayState = GLOBAL_CONSTANT.PLAY_STATE.STOP;
        // 停止音频节点
        this.bufferedSourceNode.stop(0);
        this.bufferedSourceNode.disconnect(0);
        // 清除音频节点
        this.bufferedSourceNode = null;
        layui.event.call(this, MOD_NAME + '-' + this.id, 'playEnd', {});
      }
    },

    /**
     * @inner 切换循环状态
     * @param loop {Boolean} 循环状态 true | false
     */
    switchLoop: function(loop = false){
      this.playLoop = loop;
      // if(this.bufferedSourceNode)
      //   this.bufferedSourceNode.loop = this.playLoop;
    },

    /**
     * @inner 修改播放的倍速
     * @param speed {Number} 播放倍速  0-2:大于1减速;小于1加速
     */
    changePlaySpeed: function (speed = 1){
      this.playSpeed = speed;
      if(this.bufferedSourceNode)
        this.bufferedSourceNode.playbackRate.setValueAtTime(this.playSpeed, this.getAudioContext().currentTime);
    },

    /**
     * @inner 初始化音频分析节点
     */
    initAnalyser: function (){
      this.analyser = this.getAudioContext().createAnalyser();
      this.analyser.fftSize = 4096;
      this.frequencyBinCount =  this.analyser.frequencyBinCount;
      this.analyArray = new Uint8Array(this.frequencyBinCount);
    },

    /**
     * @inner 连接音频分析节点
     * @param node {AudioNode} 上一个音频节点
     */
    connectAnalyser: function (node){
      if(!this.analyser) this.initAnalyser();
      // 清除之前的连接信息(可能连者之前的音频节点)
      this.analyser.disconnect(0);
      node.connect(this.analyser);
      // 连接下一个混响节点
      this.connectReverberation(this.analyser);
    },

    /**
     * @inner 初始化音频混响节点
     * @desc
     *    该混响节点由一个延时音频delayNode和它的声音增益delayGainNode组成
     *    可以通过调节声音增益delayGainNode来控制混响的加入或取消
     */
    initReverberation: function(){
      this.delayNode = this.getAudioContext().createDelay();
      this.delayGainNode = this.getAudioContext().createGain();
      // this.delayGainNode.gain.setValueAtTime(this.delayGainValue, this.getAudioContext().currentTime);
      this.delayNode.delayTime.setValueAtTime(this.delayTimeValue, this.getAudioContext().currentTime + 0.7);
      // 添加切换的监听事件
      this.on('effectChange', function(){
        this.delayGainNode.gain.setValueAtTime(this.soundEffect == GLOBAL_CONSTANT.SOUND_EFFECT.DELAY ? 1 : 0, this.getAudioContext().currentTime);
      });
    },

    /**
     * @inner 连接混响音频节点
     * @param node {AudioNode} 上一个音频节点
     */
    connectReverberation: function (node){
      if(this.delayNode) this.initReverberation();
      // 主声源直连下一个音频节点
      this.connectPanner(node);
      // 清除音频节点之前的连接
      this.delayNode.disconnect(0);
      this.delayGainNode.disconnect(0);
      // 叠加一个延时音频节点做为混响(主声源已接入下一个音频节点,所以单单控制这个delayGainNode可以调整是否使用混响)
      node.connect(this.delayGainNode);
      this.delayGainNode.connect(this.delayNode);
      // 混响音频也接入下一个音频节点
      this.connectPanner(this.delayNode);
    },

    /**
     * @inner 初始化音频立体声节点
     */
    initPanner: function(){
      // 创建5个立体声节点: 前、左上、左下、右上、右下
      this.pannerNode = this.getAudioContext().createPanner();
      this.pannerNodeTwo = this.getAudioContext().createPanner();
      this.pannerNodeThree = this.getAudioContext().createPanner();
      this.pannerNodeFour = this.getAudioContext().createPanner();
      this.pannerNodeFive = this.getAudioContext().createPanner();
      // 创建这几个立体声节点对应的音频增益节点
      this.pannerGainNode = this.getAudioContext().createGain();
      this.pannerTwoGainNode = this.getAudioContext().createGain();
      this.pannerThreeGainNode = this.getAudioContext().createGain();
      this.pannerFourGainNode = this.getAudioContext().createGain();
      this.pannerFiveGainNode = this.getAudioContext().createGain();
      // 创建一个直接接入下一步的音频增益
      this.pannerMainGainNode = this.getAudioContext().createGain();
      //设置立体声的空间位置
      this.pannerNode.positionX.setValueAtTime(3, this.getAudioContext().currentTime);
      this.pannerNode.positionY.setValueAtTime(0, this.getAudioContext().currentTime);
      this.pannerNode.positionZ.setValueAtTime(0, this.getAudioContext().currentTime);

      this.pannerNodeTwo.positionX.setValueAtTime(0, this.getAudioContext().currentTime);
      this.pannerNodeTwo.positionY.setValueAtTime(3, this.getAudioContext().currentTime);
      this.pannerNodeTwo.positionZ.setValueAtTime(-3, this.getAudioContext().currentTime);

      this.pannerNodeThree.positionX.setValueAtTime(0, this.getAudioContext().currentTime);
      this.pannerNodeThree.positionY.setValueAtTime(-3, this.getAudioContext().currentTime);
      this.pannerNodeThree.positionZ.setValueAtTime(-3, this.getAudioContext().currentTime);

      this.pannerNodeFour.positionX.setValueAtTime(0, this.getAudioContext().currentTime);
      this.pannerNodeFour.positionY.setValueAtTime(3, this.getAudioContext().currentTime);
      this.pannerNodeFour.positionZ.setValueAtTime(3, this.getAudioContext().currentTime);

      this.pannerNodeFive.positionX.setValueAtTime(0, this.getAudioContext().currentTime);
      this.pannerNodeFive.positionY.setValueAtTime(-3, this.getAudioContext().currentTime);
      this.pannerNodeFive.positionZ.setValueAtTime(3, this.getAudioContext().currentTime);

      // 添加切换的监听事件
      this.on('effectChange', function(){
        this.pannerGainNode.gain.setValueAtTime(this.soundEffect == GLOBAL_CONSTANT.SOUND_EFFECT.PANNER ? 1 : 0, this.getAudioContext().currentTime);
        this.pannerTwoGainNode.gain.setValueAtTime(this.soundEffect == GLOBAL_CONSTANT.SOUND_EFFECT.PANNER ? 1 : 0, this.getAudioContext().currentTime);
        this.pannerThreeGainNode.gain.setValueAtTime(this.soundEffect == GLOBAL_CONSTANT.SOUND_EFFECT.PANNER ? 1 : 0, this.getAudioContext().currentTime);
        this.pannerFourGainNode.gain.setValueAtTime(this.soundEffect == GLOBAL_CONSTANT.SOUND_EFFECT.PANNER ? 1 : 0, this.getAudioContext().currentTime);
        this.pannerFiveGainNode.gain.setValueAtTime(this.soundEffect == GLOBAL_CONSTANT.SOUND_EFFECT.PANNER ? 1 : 0, this.getAudioContext().currentTime);
        this.pannerMainGainNode.gain.setValueAtTime(this.soundEffect == GLOBAL_CONSTANT.SOUND_EFFECT.PANNER ? 0 : 1, this.getAudioContext().currentTime);
      });
    },

    /**
     * @inner 连接立体声音频节点
     * @param node {AudioNode} 上一个音频节点
     */
    connectPanner: function(node){
      // 清除音频节点之前的连接
      this.pannerNode.disconnect(0);
      this.pannerNodeTwo.disconnect(0);
      this.pannerNodeThree.disconnect(0);
      this.pannerNodeFour.disconnect(0);
      this.pannerNodeFive.disconnect(0);
      this.pannerGainNode.disconnect(0);
      this.pannerTwoGainNode.disconnect(0);
      this.pannerThreeGainNode.disconnect(0);
      this.pannerFourGainNode.disconnect(0);
      this.pannerFiveGainNode.disconnect(0);
      this.pannerMainGainNode.disconnect(0);
      // 先使用一个声音增益直接连下一个节点
      node.connect(this.pannerMainGainNode);
      this.connectGain(this.pannerMainGainNode);
      // 处理剩余的立体声的音频节点连接
      node.connect(this.pannerNode);
      this.pannerNode.connect(this.pannerGainNode);
      this.connectGain(this.pannerGainNode);
      node.connect(this.pannerNodeTwo);
      this.pannerNodeTwo.connect(this.pannerTwoGainNode);
      this.connectGain(this.pannerTwoGainNode);
      node.connect(this.pannerNodeThree);
      this.pannerNodeThree.connect(this.pannerThreeGainNode);
      this.connectGain(this.pannerThreeGainNode);
      node.connect(this.pannerNodeFour);
      this.pannerNodeFour.connect(this.pannerFourGainNode);
      this.connectGain(this.pannerFourGainNode);
      node.connect(this.pannerNodeFive);
      this.pannerNodeFive.connect(this.pannerFiveGainNode);
      this.connectGain(this.pannerFiveGainNode);
    },

    /**
     * @inner 初始化主声音音频增益节点
     */
    initGain: function(){
      this.gainNode = this.getAudioContext().createGain();
      // this.gainNode.gain.setValueAtTime(1, this.getAudioContext().currentTime);
      this.gainNode.connect(this.getAudioContext().destination);
      // 添加切换的监听事件
      this.on('setVolume', function(){
        this.gainNode.gain.setValueAtTime(this.volume, this.getAudioContext().currentTime);
      });
    },

    /**
     * @inner 连接最终的音频增益
     * @param node {AudioNode} 上一个音频节点
     */
    connectGain: function(node){
      if(!this.gainNode){
        this.gainNode = this.getAudioContext().createGain();
        this.gainNode.gain.setValueAtTime(1, this.getAudioContext().currentTime);
        this.gainNode.connect(this.getAudioContext().destination);
      }
      node.connect(this.gainNode);
    },

    /**
     * @inner 切换当前的声效配置
     * @param effect {String} 声效名称
     * @desc
     *    {@linkplain GLOBAL_CONSTANT.SOUND_EFFECT 声效名称}
     */
    changeSoundEffect: function (effect){
      // 修改声效的配置
      this.soundEffect = effect;
      // 执行切换的回调函数
      layui.event.call(this, MOD_NAME + '-' + this.id, 'effectChange', {});
    },

    /**
     * @inner 设置声音(主要的声音设置)
     * @param value
     */
    setVolume: function(value){
      let _value = parseFloat(value) || 0;
      if(_value < 0) _value = 0;
      if(_value > 2) _value = 2;
      this.volume = _value;
      // 执行切换的回调函数
      layui.event.call(this, MOD_NAME + '-' + this.id, 'setVolume', {});
    },

    /**
     * @inner 成功播放回调函数
     */
    playCallBack: function (){
      let self = this;
      // 记录起始时间
      self.startTime =  self.getAudioContext().currentTime - self.playCurrentTime;
      // 修改状态
      self.playState = GLOBAL_CONSTANT.PLAY_STATE.PLAYING
      self.lastPlayState = GLOBAL_CONSTANT.PLAY_STATE.PLAYING;
      // 调取播放事件
      self.doPlayingCallBack(function(){
        // 增长计数
        self.currentTime = (self.getAudioContext().currentTime - self.startTime) * self.playSpeed;
        self.proccess = self.currentTime / self.duration;
        // 如果有dom节点,执行dom节点更新回调(暂时和下面的合并)
        // 执行播放进行的回调函数
        layui.event.call(self, MOD_NAME + '-' + self.id, 'playing', {});
      });
      // 调取播放分析事件
      self.doAnalyserCallBack(function (){
        // 执行分析中的回调函数
        layui.event.call(self, MOD_NAME + '-' + self.id, 'analy', {});
      });
      // 执行开始播放的回调函数
      layui.event.call(self, MOD_NAME + '-' + self.id, 'playStart', {});
    },

    /**
     * @inner 播放中回调事件处理
     * @param {Function} callBack 事件
     */
    doPlayingCallBack: function(callBack){
      let self = this;
      // 当前的上下文处于正常运行状态
      // if(self.getAudioContext().state == GLOBAL_CONSTANT.CONTEXT.CONTEXT_RUNNING_STATE){
      if(self.playState != GLOBAL_CONSTANT.PLAY_STATE.STOP){
        self.proccessIndex = setTimeout(function(){
          // 再次判断状态
          // if(self.getAudioContext().state == GLOBAL_CONSTANT.CONTEXT.CONTEXT_RUNNING_STATE){
          if(self.playState == GLOBAL_CONSTANT.PLAY_STATE.PLAYING)
            callBack && callBack.call(self);
          self.doPlayingCallBack(callBack);
        }, 500);
      }
    },

    /**
     * @inner 播放分析回调事件处理
     * @param {Function} callBack 事件
     */
    doAnalyserCallBack: function(callBack){
      let self = this;
      // 当前的上下文处于正常运行状态
      // if(self.getAudioContext().state == GLOBAL_CONSTANT.CONTEXT.CONTEXT_RUNNING_STATE){
      if(self.playState != GLOBAL_CONSTANT.PLAY_STATE.STOP){
        self.analyingIndex = animate.requestAnimationFrame(function(){
          // if(self.getAudioContext().state == GLOBAL_CONSTANT.CONTEXT.CONTEXT_RUNNING_STATE){
          if(self.playState == GLOBAL_CONSTANT.PLAY_STATE.PLAYING){
            self.analyser.getByteFrequencyData(self.analyArray);
            callBack && callBack.call(self);
          }
          self.doAnalyserCallBack(callBack);
        });
      }
    },


  };

  musicProxy.fn.newInstance.prototype = musicProxy.fn;

  exports(MOD_NAME, musicProxy);
});
