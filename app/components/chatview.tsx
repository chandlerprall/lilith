import { registerComponent, element, Signal } from "@venajs/core";
import { sessions } from "../project.mjs";
import { activeSession, continueSession, resetSession, closeSession } from "../session.mjs";

import "./newchat.js";

const isActiveSessionBusy = activeSession.map((session) => {
	return session?.busy ?? true;
});

function refreshSessions() {
	sessions.dirty = true;
}

declare global {
	namespace Vena {
		interface Elements {
			"l-chatview": {};
		}
	}
}

registerComponent("l-chatview", ({ render, element: me }) => {
	function scrollMessages() {
		setTimeout(() => {
			me.shadowRoot?.getElementById("messages")?.scrollBy(0, Number.MAX_SAFE_INTEGER);
		});
	}
	activeSession.on(scrollMessages);
	scrollMessages();

	const handleMessageKeyDown = (event: Event) => {
		// @ts-expect-error
		if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
			const msgEl: HTMLTextAreaElement = me.shadowRoot!.querySelector("#message")!;
			const content = msgEl.value;
			msgEl.value = "";

			if (activeSession.value) {
				continueSession(
					activeSession.value,
					{
						role: "user",
						content,
					},
					true // force it to send, even if autorun is disabled
				);
			}
		}
	};

	const showNewSession = new Signal(false);

	const newSessionUI = element(
		<div id="newSession" data-visible={showNewSession}>
			<div id="newSessionContent">
				<l-newchat
					onl-newchat-create={(e: Event) => {
						showNewSession.value = false;
						e.preventDefault();
					}}
				></l-newchat>
				<button id="cancelNewSession" onclick={() => (showNewSession.value = false)}>
					cancel
				</button>
			</div>
		</div>
	);

	const sessionTabs = element(
		<nav>
			{sessions.map((sessions) =>
				sessions.map((session) => {
					return element(
						<button
							data-active={activeSession.value === session}
							onclick={() => {
								activeSession.value = session;
								refreshSessions();
							}}
						>
							{session.meta.task.type !== "none" && session.meta.task.title ? session.meta.task.title : "untitled"}
						</button>
					);
				})
			)}
		</nav>
	);

	render(
		<>
			<style>{`
        :host {
          display: block;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        section {
          display: grid;
          grid: auto auto 1fr auto / auto;
          width: 100%;
          height: 100%;
        }

        nav {
          display: flex;
          gap: 0px;
          overflow-x: auto;
          padding: 10px;

          button {
            cursor: pointer;
            padding: 10px;
            border: 1px solid #e0e0e0;
            background-color: #e0e0e0;
            
            &[data-active] {
              background-color: white;
              margin-top: -5px;
              padding-top: 15px;
              border-radius: 5px 5px 0 0;
            }
          }
        }
        
        h2 {
          margin: 0;
          padding-top: 10px;
          text-align: center;
        }
        
        #messages {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
        }
        
        textarea {
          box-sizing: border-box;
          width: 100%;
          height: 8.5lh;
          border: 1px solid #e0e0e0;
          
          &:focus {
            outline: none;
          }
        }

        .meta {
          font-weight: normal;
          display: inline-block;
          font-size: 12px;
        }

        #newSessionBtn {
          float: right;
          margin-right: 12px;
        }

        #newSession {
          display: none;

          &[data-visible] {
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);

            #newSessionContent {
              background-color: white;
              display: inline-block;
              width: fit-content;
              height: fit-content;
              position: absolute;
              padding: 10px;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
            }

            #cancelNewSession {
              margin: 12px auto 0;
              display: block;
            }
          }
        }
      `}</style>

			{newSessionUI}

			{sessions.map((sessions) => {
				return sessions.length === 0
					? element(
							<l-newchat>
								<span slot="title">No sessions</span>
							</l-newchat>
					  )
					: element(
							<section>
								{sessionTabs}
								{activeSession.map((activeSession) => {
									return element(
										<h2>
											chat
											<div className="meta">
												<button onclick={() => activeSession && resetSession(activeSession)}>reset</button>
												<button
													onclick={(e: Event) => {
														const btn = e.target as HTMLButtonElement;
														if (btn.innerText === "close") {
															btn.innerText = "are you sure?";

															setTimeout(() => {
																btn.innerText = "close";
															}, 2500);
														} else {
															activeSession && closeSession(activeSession);
														}
													}}
												>
													close
												</button>
												tokens used: {activeSession?.tokensUsed}
												<input
													type="checkbox"
													checked={activeSession?.autorun}
													onchange={(e) => {
														activeSession && (activeSession.autorun = (e.target as HTMLInputElement).checked);
														refreshSessions();
													}}
												/>{" "}
												auto-run
											</div>
											<button id="newSessionBtn" onclick={() => (showNewSession.value = true)}>
												new session
											</button>
										</h2>
									);
								})}
								<div id="messages">
									{activeSession.map((actionSession) => {
										const messages = actionSession?.messages ?? [];
										return messages.map((message) => {
											return element(<l-message message={message}></l-message>);
										});
									})}
								</div>
								<textarea id="message" disabled={isActiveSessionBusy} placeholder={isActiveSessionBusy.map((busy) => (busy ? "processing..." : "type a message"))} onkeydown={handleMessageKeyDown}></textarea>
							</section>
					  );
			})}
		</>
	);
});
