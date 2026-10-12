// 2. Vendor Bulk CSV Upload & Verification
document.getElementById('verifyCsvBtn').addEventListener('click', async function() {
    const inputVendor = document.getElementById('vendorNameInput').value.trim().toLowerCase();
    const fileInput = document.getElementById('vendorCsvFile');
    const progressDiv = document.getElementById('verifyProgress');

    if (!inputVendor || !fileInput.files[0]) {
        alert('Vendor ka naam aur CSV file dono lazmi hain!');
        return;
    }

    const file = fileInput.files[0]; // <--- یہ لائن مسنگ تھی جس کی وجہ سے اٹک رہا تھا!
    const reader = new FileReader();
    progressDiv.textContent = 'Vendor file process ho rahi hai...';

    reader.onload = async function(e) {
        const vendorMap = parseVendorCSV(e.target.result);
        if (vendorMap.size === 0) {
            alert('File mein koi valid URL nahi mila!');
            progressDiv.textContent = '';
            return;
        }

        try {
            const response = await fetch('/api/links');
            const textResponse = await response.text();
            let dbRecords;
            try {
                dbRecords = JSON.parse(textResponse);
            } catch (err) {
                throw new Error('Server response invalid hai: ' + textResponse.substring(0, 100));
            }

            const dbMap = new Map();

            if (Array.isArray(dbRecords)) {
                dbRecords.forEach(rec => {
                    const dbVendor = (rec.vendor_name || '').trim().toLowerCase();
                    if (dbVendor.includes(inputVendor) || inputVendor.includes(dbVendor)) {
                        if (rec.live_url) dbMap.set(rec.live_url.trim().toLowerCase(), rec);
                    }
                });
            }

            let vCount = 0, mCount = 0, misCount = 0;
            globalResults = [];

            vendorMap.forEach((vData, cleanUrl) => {
                const dbRec = dbMap.get(cleanUrl);
                if (!dbRec) {
                    mCount++;
                    globalResults.push({ url: vData.originalUrl, status: 'Missing', dbPrice: 0, vendorPrice: vData.price });
                } else {
                    const dbPrice = parseFloat(dbRec.vendor_price || 0);
                    if (vData.price > 0 && dbPrice > 0 && vData.price !== dbPrice) {
                        misCount++;
                        globalResults.push({ url: vData.originalUrl, status: 'Mismatch', dbPrice, vendorPrice: vData.price });
                    } else {
                        vCount++;
                        globalResults.push({ url: vData.originalUrl, status: 'Verified', dbPrice, vendorPrice: vData.price });
                    }
                }
            });

            document.getElementById('verifiedCount').textContent = vCount;
            document.getElementById('missingCount').textContent = mCount;
            document.getElementById('mismatchCount').textContent = misCount;

            const copyMissingBtn = document.getElementById('copyMissingBtn');
            const copyMismatchBtn = document.getElementById('copyMismatchBtn');

            if (mCount > 0) {
                copyMissingBtn.classList.remove('hidden');
                copyMissingBtn.onclick = () => {
                    navigator.clipboard.writeText(globalResults.filter(r => r.status === 'Missing').map(r => r.url).join('\n'));
                    alert('Missing links copy ho gaye!');
                };
            } else { copyMissingBtn.classList.add('hidden'); }

            if (misCount > 0) {
                copyMismatchBtn.classList.remove('hidden');
                copyMismatchBtn.onclick = () => {
                    navigator.clipboard.writeText(globalResults.filter(r => r.status === 'Mismatch').map(r => `${r.url}, ${r.vendorPrice}`).join('\n'));
                    alert('Price differences copy ho gaye!');
                };
            } else { copyMismatchBtn.classList.add('hidden'); }

            renderTable('ALL');
            progressDiv.textContent = 'Verification mukammal ho gayi! ✅';
            fileInput.value = '';
        } catch (err) {
            alert('Error: ' + err.message);
            progressDiv.textContent = '';
        }
    };
    reader.readAsText(file);
});
