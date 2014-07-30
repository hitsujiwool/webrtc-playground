(function(exports) {
  
  // create a singaling server (it's just a mock);
  var server = new Server();

  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  exports.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;

  document.addEventListener('DOMContentLoaded', function() {

    var callerView = document.querySelector('.caller-view'),
        pc = new RTCPeerConnection({ iceServers: [{ url: 'stun:stun.l.google.com:19302' }]}),
        socket = new Socket('caller', server);

    socket.on('answer', function(data) {
      var desc = new RTCSessionDescription(JSON.parse(data));
      pc.setRemoteDescription(desc);
    });

    socket.on('candidate', function(data) {
      var candidate = new RTCIceCandidate(JSON.parse(data));
      pc.addIceCandidate(candidate);
    });

    pc.addEventListener('icecandidate', function(e) {
      if (!e.candidate) return;
      socket.send('candidate', 'callee', JSON.stringify(e.candidate));
    });

    pc.addEventListener('negotiationneeded', function() {
      pc.createOffer(function(desc) {
        pc.setLocalDescription(desc);
        socket.send('offer', 'callee', JSON.stringify(desc));
      });
    });

    navigator.getUserMedia({ video: true, audio: true }, function(stream) {
      callerView.src = URL.createObjectURL(stream);
      callerView.play();
      pc.addStream(stream);  
    }, function() {});

  });

  document.addEventListener('DOMContentLoaded', function() {    
    var calleeView = document.querySelector('.callee-view'),
        pc = new RTCPeerConnection({ iceServers: [{ url: 'stun:stun.l.google.com:19302' }]}),
        socket = new Socket('callee', server);

    socket.on('offer', function(data) {
      var desc = new RTCSessionDescription(JSON.parse(data));
      pc.setRemoteDescription(desc, function() {
        pc.createAnswer(function(desc) {
          pc.setLocalDescription(desc);
          socket.send('answer', 'caller', JSON.stringify(desc));
        });
      });
    });
    
    socket.on('candidate', function(data) {
      var candidate = new RTCIceCandidate(JSON.parse(data));
      pc.addIceCandidate(candidate);
    });

    pc.addEventListener('addstream', function(e) {
      calleeView.src = URL.createObjectURL(e.stream);
      calleeView.play();
    });

    pc.addEventListener('icecandidate', function(e) {
      if (!e.candidate) return;
      socket.send('candidate', 'caller', JSON.stringify(e.candidate));
    });

  });

  function EventEmitter() {
    this.callbacks = {};
  };

  EventEmitter.prototype.on = function(event, fn) {
    (this.callbacks[event] = this.callbacks[event] || []).push(fn);
    return this;
  };

  EventEmitter.prototype.emit = function(event) {
    var args = Array.prototype.slice.call(arguments, 1),
        callbacks = this.callbacks[event],
        len;
    if (callbacks) {
      len = callbacks.length;
      for (var i = 0; i < len; ++i) {
        callbacks[i].apply(this, args);
      }
    }
    return this;
  };

  function Socket(id, server) {
    EventEmitter.call(this);
    server.addClient(id, this);
    this.server = server;
  }

  Socket.prototype = new EventEmitter();

  Socket.prototype.send = function(type, dst, data) {
    var that = this;
    this.server.send(type, dst, data);
  };

  function Server() {
    this.clients = {};
  }

  Server.prototype.addClient = function(id, socket) {
    this.clients[id] = socket;
  };

  Server.prototype.send = function(type, dst, data) {
    var that = this;
    setTimeout(function() {
      if (that.clients[dst]) {
        that.clients[dst].emit(type, data);
      }
    });
  };

})(this);
