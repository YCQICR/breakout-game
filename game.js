(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var W = canvas.width;
  var H = canvas.height;

  var scoreEl = document.getElementById("score");
  var leftEl = document.getElementById("bricks-left");
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var overlayText = document.getElementById("overlay-text");
  var pauseBtn = document.getElementById("pause");
  var resumeBtn = document.getElementById("resume");

  var PADDLE_W = 100;
  var PADDLE_H = 12;
  var PADDLE_Y = H - 32;
  var PADDLE_SPEED = 7;
  var BALL_R = 7;
  var BALL_SPEED = 4.6;
  var BASE_SPEED = 4.6;
  var MAX_SPEED = 8.5;

  var BRICK_ROWS = 5;
  var BRICK_COLS = 8;
  var BRICK_GAP = 6;
  var BRICK_TOP = 46;
  var BRICK_SIDE = 18;
  var BRICK_H = 20;
  var BRICK_W = (W - BRICK_SIDE * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;

  var ROW_COLORS = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7"];

  var keys = { left: false, right: false };
  var state = "playing"; // playing | paused | over | win
  var score = 0;
  var bricks = [];
  var paddle = { x: (W - PADDLE_W) / 2, w: PADDLE_W, h: PADDLE_H, y: PADDLE_Y };
  var ball = { x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, r: BALL_R, stuck: true };
  var time = 0;
  var lastTime = 0;

  function createBricks() {
    var list = [];
    for (var r = 0; r < BRICK_ROWS; r++) {
      for (var c = 0; c < BRICK_COLS; c++) {
        list.push({
          x: BRICK_SIDE + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          color: ROW_COLORS[r % ROW_COLORS.length],
          alive: true
        });
      }
    }
    return list;
  }

  function countAlive() {
    var n = 0;
    for (var i = 0; i < bricks.length; i++) {
      if (bricks[i].alive) n++;
    }
    return n;
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    leftEl.textContent = String(countAlive());
  }

  // 暂停 / 继续按钮可用状态
  function updateButtons() {
    pauseBtn.disabled = state !== "playing";
    resumeBtn.disabled = state !== "paused";
  }

  function launchBall() {
    if (state !== "playing" || !ball.stuck) return;
    ball.stuck = false;
    var angle = (-60 + Math.random() * 30) * Math.PI / 180; // 略微随机向上角度
    ball.vx = Math.sin(angle) * BALL_SPEED;
    ball.vy = -Math.cos(angle) * BALL_SPEED;
  }

  function resetGame() {
    score = 0;
    state = "playing";
    bricks = createBricks();
    paddle.x = (W - paddle.w) / 2;
    ball.stuck = true;
    ball.x = W / 2;
    ball.y = PADDLE_Y - ball.r - 1;
    ball.vx = 0;
    ball.vy = 0;
    keys.left = false;
    keys.right = false;
    overlay.classList.add("hidden");
    updateHud();
    updateButtons();
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    keys.left = false;
    keys.right = false;
    updateButtons();
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    updateButtons();
  }

  function togglePause() {
    if (state === "playing") {
      pauseGame();
    } else if (state === "paused") {
      resumeGame();
    }
  }

  function endGame(win) {
    state = win ? "win" : "over";
    overlayTitle.textContent = win ? "胜利！" : "游戏结束";
    overlayText.textContent = win
      ? "你清空了所有砖块，得分：" + score
      : "球掉落了，得分：" + score;
    overlay.classList.remove("hidden");
    updateButtons();
  }

  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function normalizeSpeed() {
    var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (sp === 0) return;
    var target = clamp(BASE_SPEED + (BRICK_ROWS * BRICK_COLS - countAlive()) * 0.035, BASE_SPEED, MAX_SPEED);
    var k = target / sp;
    ball.vx *= k;
    ball.vy *= k;
  }

  function update(dt) {
    if (state !== "playing" && state !== "paused") return;

    // 暂停时只更新提示动画时间，不推进游戏
    if (state === "paused") {
      time += dt;
      return;
    }

    time += dt;

    // 挡板移动
    var move = 0;
    if (keys.left) move -= 1;
    if (keys.right) move += 1;
    paddle.x = clamp(paddle.x + move * PADDLE_SPEED, 0, W - paddle.w);

    // 球未发射时跟随挡板
    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = PADDLE_Y - ball.r - 1;
      return;
    }

    // 分步移动，避免高速穿透
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) / 4));
    var sdx = (ball.vx * dt) / 16 / steps;
    var sdy = (ball.vy * dt) / 16 / steps;

    for (var s = 0; s < steps; s++) {
      ball.x += sdx;
      ball.y += sdy;

      // 左右墙
      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.r > W) {
        ball.x = W - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }

      // 上墙
      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      }

      // 挡板
      if (ball.vy > 0 &&
          ball.y + ball.r >= paddle.y &&
          ball.y - ball.r <= paddle.y + paddle.h &&
          ball.x >= paddle.x - ball.r &&
          ball.x <= paddle.x + paddle.w + ball.r) {
        ball.y = paddle.y - ball.r;
        var hitPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        hitPos = clamp(hitPos, -1, 1);
        var outAngle = hitPos * (Math.PI / 3); // 最大 60 度
        var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        ball.vx = Math.sin(outAngle) * sp;
        ball.vy = -Math.abs(Math.cos(outAngle) * sp);
        if (Math.abs(ball.vx) < 0.5) ball.vx = (Math.random() < 0.5 ? -1 : 1) * 0.5;
      }

      // 砖块
      for (var i = 0; i < bricks.length; i++) {
        var b = bricks[i];
        if (!b.alive) continue;
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
            ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          b.alive = false;
          score += 10;
          updateHud();

          // 判定反弹方向
          var overlapLeft = ball.x + ball.r - b.x;
          var overlapRight = b.x + b.w - (ball.x - ball.r);
          var overlapTop = ball.y + ball.r - b.y;
          var overlapBottom = b.y + b.h - (ball.y - ball.r);
          var minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          if (minOverlap === overlapTop && ball.vy > 0) {
            ball.vy = -Math.abs(ball.vy);
            ball.y = b.y - ball.r;
          } else if (minOverlap === overlapBottom && ball.vy < 0) {
            ball.vy = Math.abs(ball.vy);
            ball.y = b.y + b.h + ball.r;
          } else if (minOverlap === overlapLeft && ball.vx > 0) {
            ball.vx = -Math.abs(ball.vx);
            ball.x = b.x - ball.r;
          } else if (minOverlap === overlapRight && ball.vx < 0) {
            ball.vx = Math.abs(ball.vx);
            ball.x = b.x + b.w + ball.r;
          } else {
            ball.vy = -ball.vy;
          }

          normalizeSpeed();
          break;
        }
      }

      // 掉落
      if (ball.y - ball.r > H) {
        endGame(false);
        return;
      }
    }

    if (countAlive() === 0) {
      endGame(true);
    }
  }

  function roundRect(x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function draw() {
    // 背景
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#121a26");
    bg.addColorStop(1, "#0a0f16");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 网格装饰
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 32) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, H);
      ctx.stroke();
    }
    for (var gy = 0; gy < H; gy += 32) {
      ctx.beginPath();
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(W, gy + 0.5);
      ctx.stroke();
    }

    // 砖块
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      roundRect(b.x, b.y, b.w, b.h, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      roundRect(b.x + 3, b.y + 3, b.w - 6, b.h / 2.6, 3);
      ctx.fill();
    }

    // 挡板
    var grad = ctx.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.h);
    grad.addColorStop(0, "#8ecbff");
    grad.addColorStop(1, "#2f7fe0");
    ctx.fillStyle = grad;
    roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    // 球
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(140,200,255,0.9)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 未发射提示
    if (ball.stuck && state === "playing") {
      ctx.fillStyle = "rgba(200,220,255,0.75)";
      ctx.font = "15px 'PingFang SC', 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      var blink = 0.55 + 0.45 * Math.sin(time / 260);
      ctx.globalAlpha = blink;
      ctx.fillText("按 ↑ 键或空格键发射球", W / 2, H / 2 + 40);
      ctx.globalAlpha = 1;
    }

    // 暂停提示
    if (state === "paused") {
      ctx.fillStyle = "rgba(8, 12, 18, 0.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 32px 'PingFang SC', 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("已暂停", W / 2, H / 2 - 6);
      ctx.fillStyle = "rgba(200,220,255,0.8)";
      ctx.font = "15px 'PingFang SC', 'Microsoft YaHei', sans-serif";
      ctx.fillText("点击“继续”或按 P 键恢复游戏", W / 2, H / 2 + 28);
    }
  }

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    var dt = Math.min(ts - lastTime, 40);
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // 键盘
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      keys.left = true;
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      keys.right = true;
      e.preventDefault();
    } else if (e.key === "ArrowUp" || e.key === " " || e.key === "Spacebar") {
      launchBall();
      e.preventDefault();
    } else if (e.key === "p" || e.key === "P") {
      togglePause();
      e.preventDefault();
    }
  });

  document.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      keys.left = false;
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      keys.right = false;
      e.preventDefault();
    }
  });

  // 暂停 / 继续 / 重新开始按钮
  pauseBtn.addEventListener("click", pauseGame);
  resumeBtn.addEventListener("click", resumeGame);
  document.getElementById("restart").addEventListener("click", resetGame);
  document.getElementById("restart-bottom").addEventListener("click", resetGame);

  // 窗口失焦时自动暂停，避免回来时球已经掉落
  window.addEventListener("blur", pauseGame);

  // 触屏 / 鼠标也可控制挡板（额外便利，非必需）
  canvas.addEventListener("mousemove", function (e) {
    if (state !== "playing") return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) * (W / rect.width);
    paddle.x = clamp(x - paddle.w / 2, 0, W - paddle.w);
  });
  canvas.addEventListener("click", function () {
    launchBall();
  });
  canvas.addEventListener("touchmove", function (e) {
    if (state !== "playing" || !e.touches[0]) return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.touches[0].clientX - rect.left) * (W / rect.width);
    paddle.x = clamp(x - paddle.w / 2, 0, W - paddle.w);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchstart", function (e) {
    launchBall();
    e.preventDefault();
  }, { passive: false });

  resetGame();
  requestAnimationFrame(loop);
})();
