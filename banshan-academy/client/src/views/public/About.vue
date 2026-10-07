<template>
  <div class="about-page">
    <header class="page-head container">
      <p class="kicker">About</p>
      <h1 class="page-title">关于半山学堂</h1>
      <p class="page-sub en-sub">Banshan Academy</p>
    </header>

    <div class="container about-body">
      <div class="about-text">
        <p>
          半山学堂是一个关注<b>设计艺术</b>与<b>设计教育</b>的个人内容平台，由视觉传达设计专业的教师维护。
          这里整理设计教学案例、分享设计前沿研究的观察与思考，也发布设计艺术相关资讯。
        </p>
        <p>
          名字取自「行至半山，更见风景」——既是对教学与创作「在路上」状态的自觉，也寄托着不疾不徐、持续攀登的治学态度。
        </p>
      </div>

      <div class="about-sections">
        <div class="about-item">
          <span class="kicker">Design Art News</span>
          <h3>设计艺术信息</h3>
          <p>设计艺术相关的资讯、通知与动态。</p>
        </div>
        <div class="about-item">
          <span class="kicker">Teaching Case Library</span>
          <h3>教学案例库</h3>
          <p>按课程、年级、课题与设计方法发现教学案例，查看经授权公开的学生作品与教学资源。</p>
        </div>
        <div class="about-item">
          <span class="kicker">Frontiers</span>
          <h3>设计前沿研究</h3>
          <p>追踪设计学科的前沿议题与趋势。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-head {
  padding: 96px 0 56px;
  border-bottom: 1px solid var(--c-line);
  margin-bottom: 56px;
}

.page-title {
  margin-top: 14px;
  font-size: 44px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.page-sub {
  margin-top: 14px;
  font-size: 14px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.about-body {
  max-width: 760px;
}

.about-text {
  font-size: 16px;
  line-height: 2;
  color: var(--c-ink-soft);
}

.about-text p {
  margin-bottom: 1.4em;
}

.about-text b {
  color: var(--c-ink);
  font-weight: 600;
}

.about-sections {
  margin-top: 56px;
  display: grid;
  gap: 1px;
  background: var(--c-line);
  border: 1px solid var(--c-line);
}

.about-item {
  background: #fff;
  padding: 28px 28px;
}

.about-item h3 {
  margin-top: 10px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.about-item p {
  margin-top: 8px;
  font-size: 14px;
  color: var(--c-muted);
  line-height: 1.8;
}
</style>
