async function test() {
    const payload = {
        customer_name: 'Kalyan Rao',
        phone: '9849988776',
        email: 'kalyan.rao@gmail.com',
        property_category: 'Site Visit',
        preferred_visit_date: '2026-10-20',
        message: 'Interested in luxury villa site visit on weekend',
        consent: 1
    };

    console.log('Sending payload:', payload);
    const res = await fetch('http://localhost:3000/api/leads/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const status = res.status;
    const json = await res.json();
    console.log('Response Status:', status);
    console.log('Response Body:', json);
}

test().catch(console.error);
