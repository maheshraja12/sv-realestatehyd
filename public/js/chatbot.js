/**
 * SV Real Estates Hyderabad — AI Concierge Chatbot Widget
 */

let chatOpen = false;

function toggleChatbot() {
    const win = document.getElementById('chatbotWindow');
    const toggleBtn = document.getElementById('chatbotToggleBtn');
    if (!win || !toggleBtn) return;

    chatOpen = !chatOpen;

    if (chatOpen) {
        win.style.display = 'flex';
        toggleBtn.querySelector('.chatbot-icon').style.display = 'none';
        toggleBtn.querySelector('.close-icon').style.display = 'block';
        document.getElementById('chatInputText')?.focus();
    } else {
        win.style.display = 'none';
        toggleBtn.querySelector('.chatbot-icon').style.display = 'block';
        toggleBtn.querySelector('.close-icon').style.display = 'none';
    }
}

function resetChat() {
    const msgContainer = document.getElementById('chatMessages');
    if (!msgContainer) return;

    msgContainer.innerHTML = `
        <div class="chat-msg bot-msg">
            <div class="msg-bubble">
                <p>Namaste! 🙏 Welcome to <strong>SV Real Estates Hyderabad</strong>.</p>
                <p>I can help you discover luxury villas, prime plots, or schedule property site visits across Hyderabad.</p>
            </div>
            <span class="msg-time">Just now</span>
        </div>
        <div class="quick-chips" id="quickChips">
            <button type="button" class="chip" onclick="handleChipClick('Villas in Jubilee Hills')">🏡 Villas</button>
            <button type="button" class="chip" onclick="handleChipClick('Plots in Kokapet')">📐 Kokapet Plots</button>
            <button type="button" class="chip" onclick="handleChipClick('Gated Apartments')">🏢 Apartments</button>
            <button type="button" class="chip" onclick="handleChipClick('Schedule Site Visit')">📅 Site Visit</button>
            <button type="button" class="chip" onclick="handleChipClick('Connect with Agent')">📞 Call Agent</button>
        </div>
    `;
}

function handleChipClick(text) {
    const input = document.getElementById('chatInputText');
    if (input) {
        input.value = text;
        handleChatSubmit(new Event('submit'));
    }
}

async function handleChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('chatInputText');
    const msg = input?.value.trim();
    if (!msg) return;

    input.value = '';
    appendMessage(msg, 'user');

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        await processUserMessage(msg, typingId);
    } catch (err) {
        removeTypingIndicator(typingId);
        appendMessage('I apologize, but I encountered a momentary connection hiccup. Would you like to speak directly with an advisor at +91-9876543210?', 'bot');
    }
}

function appendMessage(text, sender, extraHtml = '') {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-msg ${sender}-msg`;
    div.innerHTML = `
        <div class="msg-bubble">
            <p>${text}</p>
            ${extraHtml}
        </div>
        <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    const id = 'typing_' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'chat-msg bot-msg';
    div.innerHTML = `
        <div class="msg-bubble" style="color:#d4af37; padding:8px 16px;">
            <i class="fas fa-circle-notch fa-spin"></i> Typing...
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

async function processUserMessage(msg, typingId) {
    const lower = msg.toLowerCase();

    // Check if user wants to schedule site visit or request callback
    if (lower.includes('site visit') || lower.includes('schedule') || lower.includes('appointment') || lower.includes('call agent') || lower.includes('contact') || lower.includes('callback')) {
        removeTypingIndicator(typingId);
        const formHtml = `
            <div style="margin-top:10px; background:#0f1116; padding:12px; border-radius:8px; border:1px solid #272c38;">
                <p style="font-size:0.85rem; margin-bottom:8px; color:#f5d77f;"><strong>Share your details for instant callback:</strong></p>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <input type="text" id="chatLeadName" placeholder="Your Full Name" style="padding:8px; background:#1b1e27; border:1px solid #272c38; border-radius:4px; color:#fff; font-size:0.85rem;">
                    <input type="tel" id="chatLeadPhone" placeholder="Mobile Number" style="padding:8px; background:#1b1e27; border:1px solid #272c38; border-radius:4px; color:#fff; font-size:0.85rem;">
                    <button type="button" onclick="submitChatEnquiry()" style="background:#d4af37; color:#000; border:none; padding:8px; border-radius:4px; font-weight:700; cursor:pointer; font-size:0.85rem;">Submit Request</button>
                </div>
            </div>
        `;
        appendMessage("I would be delighted to connect you with our senior property relationship manager or arrange a chauffeured site visit.", 'bot', formHtml);
        return;
    }

    // Office address
    if (lower.includes('office') || lower.includes('location') || lower.includes('address') || lower.includes('where')) {
        removeTypingIndicator(typingId);
        appendMessage("Our corporate office is located at <strong>Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033</strong>. We are open from 8:00 AM to 9:00 PM throughout the week.", 'bot');
        return;
    }

    // NRI inquiry
    if (lower.includes('nri') || lower.includes('usa') || lower.includes('dubai') || lower.includes('abroad')) {
        removeTypingIndicator(typingId);
        appendMessage("We specialize in <strong>NRI property management</strong> with end-to-end Power of Attorney (POA) assistance, high-definition 4K video walkthroughs, and verified title due diligence.", 'bot');
        return;
    }

    // Default: Search Properties via Backend API
    let category = '';
    if (lower.includes('villa')) category = 'villa';
    else if (lower.includes('plot')) category = 'residential_plot';
    else if (lower.includes('apartment') || lower.includes('flat')) category = 'apartment';
    else if (lower.includes('commercial') || lower.includes('office') || lower.includes('showroom')) category = 'commercial';

    let bedrooms = '';
    if (lower.includes('2bhk') || lower.includes('2 bhk') || lower.includes('2 bedroom')) bedrooms = '2';
    else if (lower.includes('3bhk') || lower.includes('3 bhk') || lower.includes('3 bedroom')) bedrooms = '3';
    else if (lower.includes('4bhk') || lower.includes('4 bhk') || lower.includes('4 bedroom')) bedrooms = '4';
    else if (lower.includes('5bhk') || lower.includes('5 bhk') || lower.includes('5 bedroom')) bedrooms = '5';

    let location = '';
    if (lower.includes('jubilee')) location = 'Jubilee Hills';
    else if (lower.includes('banjara')) location = 'Banjara Hills';
    else if (lower.includes('kokapet')) location = 'Kokapet';
    else if (lower.includes('financial district') || lower.includes('nanakramguda')) location = 'Financial District';
    else if (lower.includes('gachibowli')) location = 'Gachibowli';
    else if (lower.includes('madhapur') || lower.includes('hitec')) location = 'Madhapur';
    else if (lower.includes('kondapur')) location = 'Kondapur';
    else if (lower.includes('tellapur')) location = 'Tellapur';
    else if (lower.includes('kollur')) location = 'Kollur';
    else if (lower.includes('mokila')) location = 'Mokila';
    else if (lower.includes('shankarpally')) location = 'Shankarpally';
    else if (lower.includes('bachupally')) location = 'Bachupally';
    else if (lower.includes('miyapur')) location = 'Miyapur';
    else if (lower.includes('kompally')) location = 'Kompally';
    else if (lower.includes('shamshabad')) location = 'Shamshabad';
    else if (lower.includes('manikonda')) location = 'Manikonda';
    else if (lower.includes('puppalaguda')) location = 'Puppalaguda';
    else if (lower.includes('nallagandla')) location = 'Nallagandla';
    else if (lower.includes('gandipet')) location = 'Gandipet';
    else if (lower.includes('pragathi')) location = 'Pragathi Nagar';

    const res = await fetch('/api/chatbot/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: msg,
            category: category || undefined,
            location: location || undefined,
            bedrooms: bedrooms || undefined
        })
    });

    const data = await res.json();
    removeTypingIndicator(typingId);

    if (data.properties && data.properties.length > 0) {
        let cardsHtml = '';
        data.properties.slice(0, 3).forEach(p => {
            const price = p.price
                ? (p.price >= 10000000 ? (p.price / 10000000).toFixed(2) + ' Cr' : (p.price / 100000).toFixed(2) + ' L')
                : 'On Request';

            cardsHtml += `
                <div class="chat-prop-card">
                    ${p.cover_image ? `<img src="${p.cover_image}" alt="${p.title}" class="chat-prop-thumb">` : ''}
                    <div class="chat-prop-info">
                        <div class="chat-prop-title">${p.title}</div>
                        <div class="chat-prop-price">₹${price} • ${p.locality || p.city}</div>
                        <a href="/properties/${p.id}" target="_blank" class="chat-prop-btn">View Property Details</a>
                    </div>
                </div>
            `;
        });

        appendMessage(data.message || `Here are our verified matches in Hyderabad:`, 'bot', cardsHtml);
    } else {
        appendMessage("I couldn't find exact matches for that specific query in our active inventory. However, we have prime off-market properties available. Would you like me to connect you with an advisor?", 'bot');
    }
}

async function submitChatEnquiry() {
    const nameInput = document.getElementById('chatLeadName');
    const phoneInput = document.getElementById('chatLeadPhone');

    const customer_name = nameInput?.value.trim();
    const phone = phoneInput?.value.trim();

    if (!customer_name || !phone) {
        alert('Please enter your name and phone number.');
        return;
    }

    try {
        const res = await fetch('/api/chatbot/enquiry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_name, phone, message: 'Enquiry via AI chatbot' })
        });
        const result = await res.json();

        if (res.ok) {
            appendMessage(`Thank you, <strong>${customer_name}</strong>! Your enquiry has been received (Ref: <strong>${result.lead_code || 'SV-LEAD'}</strong>). Our senior property consultant will call you shortly.`, 'bot');
        } else {
            appendMessage(result.error || 'Failed to register enquiry. Please call us directly.', 'bot');
        }
    } catch (e) {
        appendMessage('Connection error. Please call our office directly at +91-9876543210.', 'bot');
    }
}
