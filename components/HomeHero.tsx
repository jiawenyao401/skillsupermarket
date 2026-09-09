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
          <Link className="home-text-link" href="#homepage-evaluation-source">评测我的项目 <span aria-hidden="true">↘</span></Link>
        </div>
        <p className="home-note">公开报告无需注册 · 历史评测不等于安全认证</p>
      </div>
      <HomeReportPreview example={example} />
      <form action="/evaluate" method="get" className="home-evaluate">
        <label htmlFor="homepage-evaluation-source">已有想用的项目？把地址放进来</label>
        <div className="home-input-row">
          <input id="homepage-evaluation-source" name="source" type="text" inputMode="url" autoComplete="url" maxLength={500} required
            aria-describedby="homepage-evaluation-help" placeholder="GitHub 地址，或 npm / pypi:包名" />
          <button type="submit" className="home-submit">生成评测 <ArrowRight aria-hidden="true" size={16} /></button>
        </div>
        <p id="homepage-evaluation-help" className="home-note">支持公开 GitHub、npm 与 PyPI 项目。登录后保留输入，提交前可查看额度。</p>
      </form>
    </section>
  );
}
