import { registerComponent } from '@venajs/core';

registerComponent('pm-sidebar', ({ render }) => {
  render`
    <style>
      :host {
        display: block;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        border-right: 1px solid #e0e0e0;
        background-color: #f0f0f0;

        h2 {
            margin: 0;
            padding-top: 10px;
            text-align: center;
        }
      }
    </style>
    
    <section>
      <h2>issues</h2>
    </section>
  `;
});