import React from 'react'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="header">
        <nav className="nav">
          <div className="nav-brand">
            <div className="logo-icon">NC</div>
            <span className="logo-text">NoteCove</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#download">Download</a>
            <a href="#docs">Docs</a>
            <a href="https://github.com/drewcsillag/notecove">GitHub</a>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              Advanced Notes for <span className="highlight">Everyone</span>
            </h1>
            <p className="hero-subtitle">
              A cross-platform notes application with advanced organization,
              collaboration, and power-user features. Works offline-first
              with file-based sync.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary">Download Desktop</button>
              <button className="btn btn-secondary">View on GitHub</button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="app-mockup">
              <div className="mockup-window">
                <div className="mockup-header">
                  <div className="mockup-controls">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="mockup-title">NoteCove</div>
                </div>
                <div className="mockup-content">
                  <div className="mockup-sidebar">
                    <div className="mockup-search"></div>
                    <div className="mockup-notes">
                      <div className="mockup-note active"></div>
                      <div className="mockup-note"></div>
                      <div className="mockup-note"></div>
                    </div>
                  </div>
                  <div className="mockup-editor">
                    <div className="mockup-editor-header"></div>
                    <div className="mockup-editor-content">
                      <div className="mockup-line long"></div>
                      <div className="mockup-line medium"></div>
                      <div className="mockup-line short"></div>
                      <div className="mockup-line long"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="features">
          <div className="section-content">
            <h2 className="section-title">Built for Power Users</h2>
            <div className="features-grid">
              <div className="feature">
                <div className="feature-icon">🌐</div>
                <h3>Cross-Platform</h3>
                <p>Desktop and iOS apps with synchronized experience</p>
              </div>
              <div className="feature">
                <div className="feature-icon">📱</div>
                <h3>Offline-First</h3>
                <p>Full functionality without internet connection</p>
              </div>
              <div className="feature">
                <div className="feature-icon">🔄</div>
                <h3>File-Based Sync</h3>
                <p>Sync via Dropbox, Google Drive, iCloud, or any shared folder</p>
              </div>
              <div className="feature">
                <div className="feature-icon">✍️</div>
                <h3>Rich Text Editing</h3>
                <p>Advanced formatting, tables, and embedded content</p>
              </div>
              <div className="feature">
                <div className="feature-icon">🏷️</div>
                <h3>Advanced Organization</h3>
                <p>Folders, tags, and inter-note linking</p>
              </div>
              <div className="feature">
                <div className="feature-icon">⚡</div>
                <h3>Power Features</h3>
                <p>Scripting API, templates, and extensibility</p>
              </div>
            </div>
          </div>
        </section>

        <section id="download" className="download">
          <div className="section-content">
            <h2 className="section-title">Get NoteCove</h2>
            <p className="section-subtitle">Currently in development - Phase 1</p>
            <div className="download-grid">
              <div className="download-card">
                <h3>Desktop App</h3>
                <p>Electron-based app for Windows, macOS, and Linux</p>
                <button className="btn btn-primary" disabled>Coming Soon</button>
              </div>
              <div className="download-card">
                <h3>iOS App</h3>
                <p>Native SwiftUI app for iPhone and iPad</p>
                <button className="btn btn-primary" disabled>Coming Soon</button>
              </div>
            </div>
          </div>
        </section>

        <section className="roadmap">
          <div className="section-content">
            <h2 className="section-title">Development Roadmap</h2>
            <div className="roadmap-timeline">
              <div className="roadmap-item completed">
                <div className="roadmap-marker"></div>
                <div className="roadmap-content">
                  <h4>Phase 1: Foundation</h4>
                  <p>Project setup, basic Electron app, and core structure</p>
                </div>
              </div>
              <div className="roadmap-item current">
                <div className="roadmap-marker"></div>
                <div className="roadmap-content">
                  <h4>Phase 2: Core Features</h4>
                  <p>File storage, rich text editing, and basic organization</p>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-marker"></div>
                <div className="roadmap-content">
                  <h4>Phase 3: Sync & Collaboration</h4>
                  <p>CRDT integration, conflict-free sync, and offline support</p>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-marker"></div>
                <div className="roadmap-content">
                  <h4>Phase 4: iOS Development</h4>
                  <p>Native iOS app with feature parity</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo-icon">NC</div>
            <span className="logo-text">NoteCove</span>
          </div>
          <div className="footer-links">
            <a href="https://github.com/drewcsillag/notecove">GitHub</a>
            <a href="https://github.com/drewcsillag/notecove/issues">Issues</a>
            <a href="https://github.com/drewcsillag/notecove/blob/main/LICENSE">License</a>
          </div>
          <div className="footer-copy">
            <p>&copy; 2024 NoteCove. Licensed under Apache 2.0.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App