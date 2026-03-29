import React from 'react';

export function ContactSection() {
  return (
    <section
      className="md:pt-40 bg-center z-[70] bg-[url('https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/77f55872-adf5-4910-9a7c-d21c0041bbe1_3840w.webp')] bg-cover pt-40 pb-40 relative"
      style={{
        maskImage: 'linear-gradient(90deg, transparent, black 55%, black 60%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, black 55%, black 60%, transparent)',
      }}
      id="contact"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -left-40 top-10 h-[70vh] w-[60vh] rounded-full blur-3xl opacity-25"
          style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.15), rgba(0,0,0,0))' }}
        ></div>
      </div>

      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-100 animate-in">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail h-4 w-4">
              <path d="M4 6l8 5 8-5"></path>
              <rect width="20" height="14" x="2" y="5" rx="2"></rect>
            </svg>
            Let's Work Together
          </span>
          <h2 className="mt-4 text-4xl sm:text-6xl tracking-tight font-semibold text-white animate-in">
            Ready to <span className="italic font-medium text-neutral-200">collaborate?</span>
          </h2>
          <p className="mt-4 text-neutral-400 text-lg max-w-2xl mx-auto animate-in">
            Whether you need help with product design, strategy, or education, I'm here to help bring your vision to life.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <div className="relative rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur animate-in">
            <h3 className="text-xl font-semibold text-white mb-6">Send a Message</h3>
            <form className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Name</label>
                  <input type="text" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-neutral-100 placeholder-neutral-400 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Email</label>
                  <input type="email" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-neutral-100 placeholder-neutral-400 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" placeholder="your@email.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Project Budget</label>
                <select className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-neutral-100 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20">
                  <option>$5k - $10k</option>
                  <option>$10k - $25k</option>
                  <option>$25k - $50k</option>
                  <option>$50k+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Message</label>
                <textarea rows={4} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-neutral-100 placeholder-neutral-400 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" placeholder="Tell me about your project..."></textarea>
              </div>
              <button type="submit" className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 border border-white/20 px-6 py-3 text-neutral-100 hover:bg-white/15 transition">
                <span className="font-medium">Send Message</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send h-4 w-4">
                  <path d="m22 2-7 20-4-9-9-4Z"></path>
                  <path d="M22 2 11 13"></path>
                </svg>
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur animate-in">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/10 border-white/10 p-3 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail h-6 w-6 text-white">
                    <path d="M4 6l8 5 8-5"></path>
                    <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Email</h3>
                  <p className="text-neutral-400">hello@medvault.com</p>
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur animate-in">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/10 border-white/10 p-3 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar h-6 w-6 text-white">
                    <path d="M8 2v4"></path>
                    <path d="M16 2v4"></path>
                    <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                    <path d="M3 10h18"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Schedule a Call</h3>
                  <p className="text-neutral-400">Book a free consultation</p>
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur animate-in">
              <h3 className="text-lg font-semibold text-white mb-4">Follow Us</h3>
              <div className="flex items-center gap-4">
                <a href="#" className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 text-neutral-400 hover:text-white hover:bg-white/15 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-twitter">
                    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-25 w-[60%] h-8"
          style={{ background: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 30%, transparent 70%)' }}
        ></div>
        <div className="h-px bg-white/10 w-full"></div>
      </div>
    </section>
  );
}
