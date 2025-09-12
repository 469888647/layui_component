/**
 * https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Audio_API
 */
;"use strict";
layui.define(function (exports) {

  let handler = {

    context: {
      CONTEXT_SUSPENDED_STATE:'suspended',
      CONTEXT_RUNNING_STATE:'running',
      CONTEXT_CLOSED_STATE:'closed',
      UPDATE_DURATION:100,
    },

    play: {
      LOOP_STATE:true,
      STOP_NOMAL_STATE:'stop',
      STOP_DROP_STATE:'dropend',
    },

    config: {
      delay: 0, // 是否启用氛围 1 启用 0禁用

    },

    /**
     * 获取音频上下文实例
     */
    getInstance: () => {
      /**
       * 如果已经存在就直接返回
       * 如果销毁上下文要将this.context设置为空
       */
      if(handler.audioContext){
          return handler.audioContext;
      }
      /**
       *  判断浏览器是否支持   普通  ||  谷歌  || 火狐
       */
      window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;
      if(!window.AudioContext){
          return false;
      }
      handler.audioContext = new AudioContext();
      return handler.audioContext;
    },

    /**
     * 获取音频上下文实例(使其状态为handler.context.CONTEXT_RUNNING_STATE)
     */
    getContext: () => {
      let context = handler.getInstance();
      if(!context)  return null;
      let state = context.state;
      /**
       * context已经被销毁需要重新创建一个context
       */
      if(state == handler.context.CONTEXT_CLOSED_STATE){
        handler.context = null;
        context = handler.getInstance();
        if(!context)  return null;
      }
      /**
       * context被阻塞需要恢复context
       */
      if(state == handler.context.CONTEXT_SUSPENDED_STATE){
        context.resume();
      }
      return context;
    },

    requestAnimationFrame: (fn) => {
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

    cancelAnimationFrame: (id) => {

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

    /**
     * 文件解码，一般处理使用file插件从本地获取到的音频文件
     * @param {*} file
     * @param {*} cb 
     */
    loadFile: (file, cb) => {
      let fileReader = new FileReader();
      fileReader.onload = function(e){
          let fileResult = e.target.result;
          handler.getContext().decodeAudioData(fileResult,function(buffer){
              cb && cb(buffer);
          },function(e){"Error with decoding audio data" + e.err});
      };
      fileReader.onerror = function(){
          console.warn('解析文件出错!',e);
      };
      fileReader.readAsArrayBuffer(file);
    },

    loadUrl: (uri,cb) => {
      let request = new XMLHttpRequest();
      request.open('GET', uri, true);
      request.responseType = 'arraybuffer';
      request.onload = function(){
          let audioData = request.response;
          handler.getContext().decodeAudioData(audioData,function(buffer){
              cb && cb(buffer);
          },function(e){"Error with decoding audio data" + e.err});
      }
      request.send();
    },

    /**
     * 暂停播放
     */
    // suspend: () => {
    //   let context = handler.getInstance();
    //   if(!context){
    //     return;
    //   }
    //   let state = context.state;
    //   if(state == handler.context.CONTEXT_RUNNING_STATE){
    //     // TODO 
    //       c.AudioUtil.pause(function(){ 
    //         context.suspend(); cb && cb(); 
    //       });
    //   }else{
    //     //  cb && cb();
    //   }
    // },

    // /**
    //  * 恢复播放
    //  */
    // resume: () => {
    //   let context = handler.getInstance();
    //   if(!context){
    //       // 无法创建音频上下文
    //       return;
    //   }
    //   let state = context.state;
    //   context.resume();
    //   // TODO 
    //   c.AudioUtil.resume(cb);
    // },


    playBuffer: (buffer) => {
      /**
       * 清除之前的node节点
       */
      if(handler.bufferedSourceNode){
        handler.interrupt();
      }
      handler.bufferedSourceNode = handler.getContext().createBufferSource();
      handler.buffer = buffer;
      handler.duration = buffer.duration;
      handler.STOP_STATE = handler.play.STOP_NOMAL_STATE;
      handler.bufferedSourceNode.buffer = handler.buffer;
      handler.bufferedSourceNode.loop = true;

      // 倍速播放
      handler.bufferedSourceNode.playbackRate.value = 1;

      handler.bufferedSourceNode.onended = function(){
        handler.analyingIndex && handler.cancelAnimationFrame(handler.analyingIndex);
        handler.proccessIndex && clearTimeout(handler.proccessIndex);
        // handler.STOP_STATE == handler.play.STOP_NOMAL_STATE && audio.trigger('playend');
        handler.bufferedSourceNode = null;
      }

      // handler.bufferedSourceNode.loopEnd = function(){
      //   handler.startTime =  handler.getContext().currentTime;
      // }

      // ＴＯＤＯ连接目的地
      handler.connectAnalyser(handler.bufferedSourceNode);

      handler.bufferedSourceNode.start(0);
      // 记录起始时间
      handler.startTime =  handler.getContext().currentTime;
      handler.playing(function(){
        // 增长计数
        handler.currentTime = (handler.getContext().currentTime - handler.startTime) * 1;
        handler.proccess = handler.currentTime / handler.duration;
      });
      handler.analying(function(){
        handler.analyser.getByteFrequencyData(handler.dataArray);
        let size = 50;
        let dataProvider = [];
        for (let i = 0; i < size * size; i++) {
          let x = i % size;
          let y = Math.floor(i / size);
          let dx = x - size / 2;
          let dy = y - size / 2;
          let angle = Math.atan2(dy, dx);
          if (angle < 0) {
              angle = Math.PI * 2 + angle;
          }
          let dist = Math.sqrt(dx * dx + dy * dy);
          idx = Math.min(
              handler.frequencyBinCount - 1, Math.round(angle / Math.PI / 2 * 60 + dist * 60) + 100
              );
          let val = Math.pow(handler.dataArray[idx] / 100, 3);
          dataProvider.push([x, y, Math.max(val, 0.1)]);
        }
        myChart.setOption({
          series: [{
              type: 'bar3D',
              data: dataProvider
          }]
        });

      });
    },

    playing: (cb) => {
      if(handler.getContext().state == handler.context.CONTEXT_RUNNING_STATE){
        handler.proccessIndex = setTimeout(function(){
          if(handler.getContext().state == handler.context.CONTEXT_RUNNING_STATE){
            cb && cb();
            handler.playing(cb);
          }
        }, 1000);
      }
    },

    analying: (cb) => {
      if(handler.getContext().state == handler.context.CONTEXT_RUNNING_STATE){
        handler.analyingIndex = handler.requestAnimationFrame(function(){
          if(handler.getContext().state == handler.context.CONTEXT_RUNNING_STATE){
            cb && cb();
            handler.analying(cb);
          }
        });
      }
    },

    interrupt: () => {
      /**
       * 根据文档 bufferSourceNode 会自动回收
       */
      handler.STOP_STATE = handler.play.STOP_DROP_STATE;
      handler.bufferedSourceNode.stop(0);
      handler.bufferedSourceNode = null;
    },

    connectAnalyser: (node) => {
      if(!handler.analyser){
        handler.analyser = handler.getContext().createAnalyser();
        handler.analyser.fftSize = 4096;
        handler.frequencyBinCount =  handler.analyser.frequencyBinCount;
        handler.dataArray = new Uint8Array(handler.frequencyBinCount);
      }
      
      handler.analyser.disconnect(0);
      node.connect(handler.analyser);
      handler.connectReverberation(handler.analyser);
    },

    connectReverberation: (node) => {
      if(!handler.delayNode){
        handler.delayNode = handler.getContext().createDelay();
        handler.delayGainNode = handler.getContext().createGain();
        handler.delayGainNode.gain.setValueAtTime(handler.config.delay, handler.getContext().currentTime);
        handler.delayNode.delayTime.setValueAtTime(0.05, handler.getContext().currentTime + 0.7);
      }
      // 直连
      handler.connectPanner(node);
      // 解除之前的连接
      handler.delayNode.disconnect(0);
      handler.delayGainNode.disconnect(0);
      // 叠加一个音频增益为1.2的delayNode.
      node.connect(handler.delayGainNode);
      handler.delayGainNode.connect(handler.delayNode);
      handler.connectPanner(handler.delayNode);

    },

    connectPanner: (node) => {
      if(!handler.pannerNode){
        handler.pannerNode = handler.getContext().createPanner();
        handler.pannerNodeTwo = handler.getContext().createPanner();
        handler.pannerNodeThree = handler.getContext().createPanner();
        handler.pannerNodeFour = handler.getContext().createPanner();
        handler.pannerNodeFive = handler.getContext().createPanner();

        handler.pannerNode.positionX.setValueAtTime(3, handler.getContext().currentTime);
        handler.pannerNode.positionY.setValueAtTime(0, handler.getContext().currentTime);
        handler.pannerNode.positionZ.setValueAtTime(0, handler.getContext().currentTime);


        handler.pannerNodeTwo.positionX.setValueAtTime(0, handler.getContext().currentTime);
        handler.pannerNodeTwo.positionY.setValueAtTime(3, handler.getContext().currentTime);
        handler.pannerNodeTwo.positionZ.setValueAtTime(-3, handler.getContext().currentTime);

        handler.pannerNodeThree.positionX.setValueAtTime(0, handler.getContext().currentTime);
        handler.pannerNodeThree.positionY.setValueAtTime(-3, handler.getContext().currentTime);
        handler.pannerNodeThree.positionZ.setValueAtTime(-3, handler.getContext().currentTime);

        handler.pannerNodeFour.positionX.setValueAtTime(0, handler.getContext().currentTime);
        handler.pannerNodeFour.positionY.setValueAtTime(3, handler.getContext().currentTime);
        handler.pannerNodeFour.positionZ.setValueAtTime(3, handler.getContext().currentTime);

        handler.pannerNodeFive.positionX.setValueAtTime(0, handler.getContext().currentTime);
        handler.pannerNodeFive.positionY.setValueAtTime(-3, handler.getContext().currentTime);
        handler.pannerNodeFive.positionZ.setValueAtTime(3, handler.getContext().currentTime);


        handler.pannerGainNode = handler.getContext().createGain();
        handler.pannerGainNode.gain.setValueAtTime(1, handler.getContext().currentTime);


        handler.pannerTwoGainNode = handler.getContext().createGain();
        handler.pannerTwoGainNode.gain.setValueAtTime(1, handler.getContext().currentTime);

        handler.pannerThreeGainNode = handler.getContext().createGain();
        handler.pannerThreeGainNode.gain.setValueAtTime(1, handler.getContext().currentTime);


        handler.pannerFourGainNode = handler.getContext().createGain();
        handler.pannerFourGainNode.gain.setValueAtTime(1, handler.getContext().currentTime);


        handler.pannerFiveGainNode = handler.getContext().createGain();
        handler.pannerFiveGainNode.gain.setValueAtTime(1, handler.getContext().currentTime);


      }
      node.connect(handler.pannerNode);
      handler.pannerNode.connect(handler.pannerGainNode);
      handler.connectGain(handler.pannerNode);

      node.connect(handler.pannerNodeTwo);
      handler.pannerNodeTwo.connect(handler.pannerTwoGainNode);
      handler.connectGain(handler.pannerTwoGainNode);

      node.connect(handler.pannerNodeThree);
      handler.pannerNodeThree.connect(handler.pannerThreeGainNode);
      handler.connectGain(handler.pannerThreeGainNode);

      node.connect(handler.pannerNodeFour);
      handler.pannerNodeFour.connect(handler.pannerFourGainNode);
      handler.connectGain(handler.pannerFourGainNode);

      node.connect(handler.pannerNodeFive);
      handler.pannerNodeFive.connect(handler.pannerFiveGainNode);
      handler.connectGain(handler.pannerFiveGainNode);

    },

    connectGain: (node) => {
      if(!handler.gainNode){
        handler.gainNode = handler.getContext().createGain();
        handler.gainNode.gain.setValueAtTime(1, handler.getContext().currentTime);
        handler.gainNode.connect(handler.getContext().destination);
      }
      node.connect(handler.gainNode);
    },

    setVolume: (value) => {
      handler.gainNode.gain.setValueAtTime(value, handler.getContext().currentTime);
    },

    openOrClose: (f = false) => {
      handler.config.delay = f ? 1.2 : 0;
      handler.delayGainNode.gain.setValueAtTime(handler.config.delay, handler.getContext().currentTime);
    },

  };





  exports("music", handler);
});