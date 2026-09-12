import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeReportPreview, type HomeReportExample } from "./HomeReportPreview";

export function HomeHero({ example }: { example?: HomeReportExample }) {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-intro">
        <p className="home-kicker">AI SKILLS / MCP · 发现与评测</p>
        <h1 id="home-title">安装 Skill / MCP 前，<br />先看懂它<span>会做什么。</span></h1>
        <p className="home-lede">它需要哪些权限？会调用什么服务？有哪些风险值得先检查？从公开证据、流程图和改进建议开始，做出自己的选择。</p>
        <div className="home-actions">
          {example && <Link className="home-primary" prefetch={false} href={`/skill/${encodeURIComponent(example.slug)}#evaluation-report-title`}>先看真实报告 <ArrowRight aria-hidden="true" size={16} /></Link>}
          <Link className="home-text-link" href="#homepage-evaluation-source">查找我的项目 <span aria-hidden="true">↘</span></Link>
        </div>
        <p className="home-note">公开报告无需注册 · 历史评测不等于安全认证</p>
      </div>
      <HomeReportPreview example={example} />
      <form action="/search" method="get" className="home-evaluate">
        <label htmlFor="homepage-evaluation-source">已有想用的项目？先查有没有公开报告</label>
        <div className="home-input-row">
          <input id="homepage-evaluation-source" name="source" type="text" inputMode="url" autoComplete="url" maxLength={500} required
            aria-describedby="homepage-evaluation-help" placeholder="GitHub 地址，或 npm / pypi:包名" />
          <button type="submit" className="home-submit">查找报告 <ArrowRight aria-hidden="true" size={16} /></button>
        </div>
        <p id="homepage-evaluation-help" className="home-note">查找和阅读已有报告无需注册、不消耗额度。没有报告时，可保留地址继续登录评测。</p>
      </form>
    </section>
  );
}
