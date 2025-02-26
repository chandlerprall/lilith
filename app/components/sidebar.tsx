import { registerComponent, element } from "@venajs/core";
import project from "../project.mjs";

declare global {
	namespace Vena {
		interface Elements {
			"l-sidebar": {};
		}
	}
}

registerComponent("l-sidebar", ({ render }) => {
	render(
		<>
			<style>{`
        :host {
          display: block;
          width: 100%;
          height: 100%;
          overflow: scroll;
          box-sizing: border-box;
          border-right: 1px solid #e0e0e0;
          background-color: #f0f0f0;

          h2 {
              margin: 0;
              padding-top: 10px;
              text-align: center;
          }
        }

        .issues {
          list-style: none;
          padding: 0;
          margin: 0;

          [data-closed] {
            text-decoration: line-through}
          }
        }
      `}</style>

			<section>
				<h2>issues</h2>
				<ol className="issues">
					{project.issues.map((issues: any) =>
						issues.map((issue: any) => {
							return element(<li data-closed={issue.closed}>${issue.name}</li>);
						})
					)}
				</ol>
			</section>
		</>
	);
});
