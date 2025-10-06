// Search functionality for Upwork jobs using GraphQL API
let data = null;
let loading = false;
let searchKeyword = '';
let jobsPerPage = 10;
let currentPage = 1;
let totalJobs = 0;

// Modal state
let showBidModal = false;
let selectedJob = null;
let generatedMessage = '';
let bLoading = false;
let bidResponse = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch();
    setupEventListeners();

    // Prefill search keyword from settings
    if (upworkSettings && upworkSettings.search) {
        document.getElementById('searchInput').value = upworkSettings.search;
        searchKeyword = upworkSettings.search;
    }
    
    // Auto-search on page load if we have settings
    if (upworkSettings && upworkCreds) {
        fetchAndSaveResponse(currentPage);
    }
});

function initializeSearch() {
    // Check if credentials and settings are available
    if (!upworkCreds || !upworkSettings) {
        document.getElementById('searchBtn').disabled = true;
        showAlert('Please ensure Upwork is linked and settings are configured', 'warning');
    }
}

function setupEventListeners() {
    // Search button
    document.getElementById('searchBtn').addEventListener('click', handleSearch);

    // Search input enter key
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Jobs per page change
    document.getElementById('jobs-per-page').addEventListener('change', function(e) {
        handleJobsPerPageChange(Number(e.target.value));
    });

    // Pagination buttons
    document.getElementById('prevPageBtn').addEventListener('click', handlePreviousPage);
    document.getElementById('nextPageBtn').addEventListener('click', handleNextPage);

    // Bid modal submit button
    document.getElementById('submitBidBtn').addEventListener('click', submitBid);
}

function handleSearch(e) {
    if (e) e.preventDefault();

    // Get search keyword from input
    searchKeyword = document.getElementById('searchInput').value.trim();
    if (!searchKeyword) {
        searchKeyword = upworkSettings.search || '';
    }

    currentPage = 1; // Reset to first page
    fetchAndSaveResponse(currentPage);
}

async function fetchAndSaveResponse(currentPage) {
    try {
    loading = true;
    updateUI();

        const apiUrl = "https://www.upwork.com/api/graphql/v1?alias=userJobSearch";
        const authToken = upworkCreds.access_token || upworkCreds.token;
        
        if (!authToken) {
            throw new Error('No authentication token available');
        }
        
        // Parse settings arrays if they're strings
        const parseArray = (value) => {
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    return [];
                }
            }
            return [];
        };
        
        const requestVariables = {
            jobType: parseArray(upworkSettings.job_type),
            contractorTier: parseArray(upworkSettings.contractor_tier),
            workload: parseArray(upworkSettings.workload),
            durationV3: parseArray(upworkSettings.duration),
            location: parseArray(upworkSettings.location),
            clientHires: parseArray(upworkSettings.client_hires),
            proposals: parseArray(upworkSettings.proposals),
            budget: parseArray(upworkSettings.budget),
            verifiedPaymentOnly: upworkSettings.verified_payment === 1 || upworkSettings.verified_payment === true,
            hourlyRate: upworkSettings.hourly_rates || "0-100",
            sort: "recency",
            highlight: true,
            userQuery: searchKeyword,
            paging: {
                offset: (currentPage - 1) * jobsPerPage,
                count: jobsPerPage
            }
        };
        

        const requestBody = JSON.stringify({
                query: `
                query UserJobSearch($requestVariables: UserJobSearchV1Request!) {
                    search {
                        universalSearchNuxt {
                            userJobSearchV1(request: $requestVariables) {
                                paging {
                                    total
                                    offset
                                    count
                                }
                                results {
                                    id
                                    title
                                    description
                                    relevanceEncoded
                                    ontologySkills {
                                        uid
                                        parentSkillUid
                                        prefLabel
                                        prettyName: prefLabel
                                        freeText
                                        highlighted
                                    }
                                isSTSVectorSearchResult
                                applied
                                    upworkHistoryData {
                                        client {
                                            paymentVerificationStatus
                                            country
                                            totalReviews
                                            totalFeedback
                                            hasFinancialPrivacy
                                            totalSpent {
                                                isoCurrencyCode
                                                amount
                                            }
                                        }
                                        freelancerClientRelation {
                                            lastContractRid
                                            companyName
                                            lastContractTitle
                                        }
                                    }
                                    jobTile {
                                        job {
                                            id
                                            ciphertext: cipherText
                                            jobType
                                            weeklyRetainerBudget
                                            hourlyBudgetMax
                                            hourlyBudgetMin
                                            hourlyEngagementType
                                            contractorTier
                                            sourcingTimestamp
                                            createTime
                                            publishTime
                                            enterpriseJob
                                            personsToHire
                                            premium
                                            totalApplicants
                                            hourlyEngagementDuration {
                                                rid
                                                label
                                                weeks
                                                mtime
                                                ctime
                                            }
                                            fixedPriceAmount {
                                                isoCurrencyCode
                                                amount
                                            }
                                            fixedPriceEngagementDuration {
                                                id
                                                rid
                                                label
                                                weeks
                                                ctime
                                                mtime
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `,
                variables: { requestVariables }
            });
        
        const fetchOptions = {
            headers: {
                accept: "*/*",
                authorization: `bearer ${authToken}`,
                "content-type": "application/json"
            },
            body: requestBody,
            method: "POST"
        };
        
        const response = await fetch(apiUrl, fetchOptions);
        const responseData = await response.json();
        
        // Check for authentication failure
        if (responseData.message === "Authentication failed" || responseData.message === "Authentication failed") {
            alert('Your token is invalid. Please re-link your Upwork account.');
            window.location.href = 'link-upwork.php';
            return;
        }
        
        if (responseData.errors) {
            throw new Error(responseData.errors[0].message || 'GraphQL error');
        }
        
        data = responseData;
        totalJobs = responseData?.data?.search?.universalSearchNuxt?.userJobSearchV1?.paging?.total || 0;
        loading = false;
        updateUI();
        
    } catch (err) {
        console.error('Error fetching the data:', err);
        loading = false;
        updateUI();
        showAlert('Error fetching jobs: ' + err.message, 'danger');
    }
}

function handlePreviousPage() {
    if (currentPage > 1) {
        currentPage = currentPage - 1;
        fetchAndSaveResponse(currentPage);
        window.scrollTo(0, 0);
    }
}

function handleNextPage() {
    const totalPages = Math.ceil(totalJobs / jobsPerPage);
    if (currentPage < totalPages) {
        currentPage = currentPage + 1;
        fetchAndSaveResponse(currentPage);
        window.scrollTo(0, 0);
    }
}

function handlePageChange(pageNum) {
    currentPage = pageNum;
    fetchAndSaveResponse(currentPage);
    window.scrollTo(0, 0);
}

function handleJobsPerPageChange(newJobsPerPage) {
    jobsPerPage = newJobsPerPage;
    currentPage = 1; // Reset to first page when changing page size
    fetchAndSaveResponse(currentPage);
}

function updateUI() {
    const loadingState = document.getElementById('loadingState');
    const resultsContainer = document.getElementById('resultsContainer');
    const paginationControls = document.getElementById('paginationControls');

    if (loading) {
        loadingState.style.display = 'block';
        resultsContainer.innerHTML = '';
        paginationControls.style.display = 'none';
        return;
    }

    loadingState.style.display = 'none';

    if (data && data.data?.search?.universalSearchNuxt?.userJobSearchV1?.results) {
        displayResults();
        updatePagination();
    } else {
        resultsContainer.innerHTML = '<div class="text-center py-4"><p class="text-muted">No jobs found. Try adjusting your search criteria.</p></div>';
        paginationControls.style.display = 'none';
    }
}

function displayResults() {
    const resultsContainer = document.getElementById('resultsContainer');
    const jobs = data.data.search.universalSearchNuxt.userJobSearchV1.results;

    let html = `
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center">
                <div class="fw-bold">Search Results (${totalJobs} total)</div>
                <div class="text-muted">
                    Showing ${(currentPage - 1) * jobsPerPage + 1} to ${Math.min(currentPage * jobsPerPage, totalJobs)} of ${totalJobs} jobs
                </div>
            </div>
        </div>
    `;

    jobs.forEach(job => {
        html += createJobCard(job);
    });

    resultsContainer.innerHTML = html;
}

function createJobCard(job) {
    const createTime = job.jobTile?.job?.createTime;
    const timeAgo = getTimeAgo(createTime);

    const paymentVerified = job.upworkHistoryData?.client?.paymentVerificationStatus === 'VERIFIED';
    const rating = job.upworkHistoryData?.client?.totalFeedback || 0;
    const reviews = job.upworkHistoryData?.client?.totalReviews || 0;
    const country = job.upworkHistoryData?.client?.country || '';
    const totalSpent = job.upworkHistoryData?.client?.totalSpent?.amount || 0;
    const currency = job.upworkHistoryData?.client?.totalSpent?.isoCurrencyCode || '';

    const jobType = job.jobTile?.job?.jobType;
    const hourlyMin = job.jobTile?.job?.hourlyBudgetMin || 0;
    const hourlyMax = job.jobTile?.job?.hourlyBudgetMax || 0;
    const fixedAmount = job.jobTile?.job?.fixedPriceAmount?.amount || 'Not specified';
    const contractorTier = job.jobTile?.job?.contractorTier || '';
    const totalApplicants = job.jobTile?.job?.totalApplicants || 0;
    const connectPrice = 0; // connectPrice field not available in API

    const description = job.description || '';
    const shortDescription = description.length > 600 ? description.substring(0, 600) + '...' : description;

    const skills = job.ontologySkills || [];

    return `
        <div class="card mb-3" style="border-radius: 10px;">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div class="flex-grow-1">
                        <h5 class="card-title mb-1">
                            <a href="https://www.upwork.com/jobs/${job.jobTile?.job?.ciphertext}/?referrer_url_path=%2Fnx%2Fsearch%2Fjobs%2F" target="_blank" rel="noopener noreferrer" class="text-decoration-none">
                                ${escapeHtml(job.title)}
                            </a>
                        </h5>
                        <div class="text-muted" style="font-size: 10px;">
                            ${timeAgo}
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        ${paymentVerified ? 
                            '<span class="badge bg-success" style="font-size: 10px;"><i class="ri-verified-badge-line me-1" style="font-size: 12px;"></i>Payment Verified</span>' :
                            '<span class="badge bg-warning"><i class="ri-error-warning-fill me-1" style="font-size: 12px;"></i>Payment Not Verified</span>'
                        }
                        <a href="https://www.upwork.com/jobs/${job.jobTile?.job?.ciphertext}/?referrer_url_path=%2Fnx%2Fsearch%2Fjobs%2F" target="_blank" rel="noopener noreferrer" class="p-2">
                            <i class="ri-external-link-line" style="font-size: 14px;"></i>
                        </a>
                    </div>
                </div>

                <div class="row mb-3">
                    <div class="col-md-6">
                        <div class="d-flex align-items-center gap-3">
                            <div class="d-flex align-items-center mt-2">
                                ${generateStars(rating)}
                                <small class="text-muted ms-1" style="font-size: 14px;">(${reviews})</small>
                            </div>
                            <div class="text-muted" style="font-size: 14px;">
                                <i class="ri-map-pin-line me-1"></i>
                                ${escapeHtml(country)}
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 text-end">
                        <div class="text-muted" style="font-size: 14px;">
                            ${totalSpent > 0 ? `${formatNumber(totalSpent)} ${currency} spent` : 'Nothing spent'}
                        </div>
                    </div>
                </div>

                <div class="mb-2">
                    <div class="d-flex align-items-center gap-3">
                        ${jobType === 'HOURLY' && hourlyMax > 0 ? 
                            `<span class="badge bg-info" style="font-size: 10px;">Hourly: $${hourlyMin}/hr - $${hourlyMax}/hr</span>` : 
                            jobType === 'FIXED' ? 
                            `<span class="badge bg-primary" style="font-size: 10px;">Fixed: $${fixedAmount}</span>` : ''
                        }
                        ${contractorTier ? `<span class="badge bg-secondary" style="font-size: 10px;">${contractorTier}</span>` : ''}
                        ${totalApplicants > 0 ? `<span class="badge bg-primary text-white text-dark border" style="font-size: 10px;">Proposals: ${totalApplicants}</span>` : ''}
                        ${connectPrice > 0 ? `<span class="badge bg-primary text-white text-dark border" style="font-size: 10px;">Connects: ${connectPrice}</span>` : ''}
                    </div>
                </div>

                <div class="card-text mb-4" style="font-size: 12px; line-height: 1.4;">
                    ${escapeHtml(shortDescription)}
                </div>

                ${skills.length > 0 ? `
                    <div class="mb-3">
                        <div class="d-flex flex-wrap gap-1">
                            ${skills.map(skill => 
                                `<span class="badge ${skill.highlighted ? 'bg-success' : 'bg-primary text-white text-dark'}" style="font-size: 10px;">${escapeHtml(skill.prettyName)}</span>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="d-flex justify-content-between align-items-center">
                    <div></div>
                    <div>
                        ${job.applied ? 
                            `<div class="text-success" style="font-size: 16px; font-weight: 600; text-align: center; padding: 10px;">
                               Applied
                            </div>` :
                            `<button class="btn btn-primary" onclick="openBidModal('${encodeURIComponent(JSON.stringify(job))}')">
                                <i class="ri-send-plane-line me-1"></i>
                                Bid
                            </button>`
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updatePagination() {
    const paginationControls = document.getElementById('paginationControls');
    const pageInfo = document.getElementById('pageInfo');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    
    if (totalJobs <= jobsPerPage) {
        paginationControls.style.display = 'none';
        return;
    }
    
    const totalPages = Math.ceil(totalJobs / jobsPerPage);
    
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    
    paginationControls.style.display = 'flex';
}

async function openBidModal(encodedJob) {
    selectedJob = JSON.parse(decodeURIComponent(encodedJob));
    
    // Show modal first
    const modal = new bootstrap.Modal(document.getElementById('bidModal'));
    modal.show();
    
    // Show loading state in button only
    document.getElementById('generatedMessage').value = '';
    document.getElementById('submitBidBtn').disabled = true;
    document.getElementById('submitBidText').textContent = 'Generating...';
    
    try {
        // Generate bid message using OpenAI API
        await generateBidMessage();
        
        // Calculate bid price
        calculateBidPrice();
        
        // Enable submit button
        document.getElementById('submitBidBtn').disabled = false;
        document.getElementById('submitBidText').textContent = 'Submit Bid';
        
    } catch (error) {
        console.error('Error generating bid:', error);
        document.getElementById('generatedMessage').value = 'Error generating bid message. Please try again.';
        document.getElementById('submitBidBtn').disabled = false;
        document.getElementById('submitBidText').textContent = 'Submit Bid';
    }
}

async function generateBidMessage() {
    const xsrfToken = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')[1];
    
    // Retrieve values from localStorage or use defaults
    const me = localStorage.getItem('name') || 'Freelancer';
    const words = localStorage.getItem('words') || '150';
    const instruction = localStorage.getItem('instruction') || 'Write a professional and persuasive bid that highlights relevant skills and experience.';
    
    const postData = {
        model: 'gpt-3.5-turbo',
        messages: [
            {
                role: 'system',
                content: `write a short and persuasive project bid in around ${words} words using ${instruction} .my name is ${me}. `
            },
            {
                role: 'user',
                content: `
                My name is ${me}
                    Job description: ${selectedJob.description || 'No description available'}
                    Instructions: ${instruction}
                    Words: ${words}
                    [Note Important: Use line breaks as \\n wherever possible for better formatting and readability. Don't greet the user as we don't know the name.]
                    [Important: don't use H^ and ^H in the message.]
                    I will be directly forwarding this to the client so don't give a template like message. Make it unique and attractive and make sure it doesn't contain static text.
                `
            }
        ],
    };

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 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', // Replace with actual API key
            },
            body: JSON.stringify(postData)
        });

        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            generatedMessage = data.choices[0].message.content;
            document.getElementById('generatedMessage').value = generatedMessage;
        } else {
            throw new Error('Invalid response from OpenAI API');
        }
    } catch (error) {
        console.error('Error generating bid:', error);
        generatedMessage = `Hello,\n\nI am interested in this project and would like to discuss the details with you.\n\nI have experience in the required skills and can deliver high-quality work within your timeline.\n\nPlease let me know if you have any questions.\n\nBest regards`;
        document.getElementById('generatedMessage').value = generatedMessage;
    }
}

function calculateBidPrice() {
    let bidPrice = 0;
    const pricePercentage = upworkSettings?.price_percentage || 90;
    
    if (selectedJob.jobTile?.job?.jobType === 'HOURLY') {
        // For hourly jobs, use a fixed rate or calculate based on budget
        const hourlyMin = selectedJob.jobTile.job.hourlyBudgetMin || 0;
        const hourlyMax = selectedJob.jobTile.job.hourlyBudgetMax || 0;
        
        if (hourlyMax > 0) {
            // Use the maximum hourly rate as base
            bidPrice = Math.round(hourlyMax * pricePercentage / 100);
        } else if (hourlyMin > 0) {
            // Use minimum hourly rate if max is not available
            bidPrice = Math.round(hourlyMin * pricePercentage / 100);
        } else {
            // Default hourly rate if no budget info
            bidPrice = 10;
        }
        
        // Ensure minimum hourly rate
        if (bidPrice <= 0) {
            bidPrice = 10;
        }
        
        document.getElementById('bidInfo').textContent = `Hourly rate (${pricePercentage}% of max rate: $${hourlyMax}/hr)`;
    } else if (selectedJob.jobTile?.job?.jobType === 'FIXED') {
        const fixedAmount = selectedJob.jobTile.job.fixedPriceAmount?.amount || 0;
        bidPrice = Math.round(fixedAmount * pricePercentage / 100 / 5) * 5;
        
        // Ensure minimum fixed price
        if (bidPrice <= 0) {
            bidPrice = 50; // Minimum $50 for fixed jobs
        }
        
        document.getElementById('bidInfo').textContent = `Fixed price (${pricePercentage}% of ${fixedAmount})`;
    } else {
        // Default fallback
        bidPrice = 10;
        document.getElementById('bidInfo').textContent = `Default rate`;
    }
    
    document.getElementById('bidPrice').value = bidPrice;
}

async function submitBid() {
    const bidPrice = document.getElementById('bidPrice').value;
    const generatedMessage = document.getElementById('generatedMessage').value;
    
    if (!bidPrice || bidPrice <= 0) {
        alert('Please enter a valid bid amount');
        return;
    }
    
    document.getElementById('submitBidBtn').disabled = true;
    document.getElementById('submitBidText').textContent = 'Submitting...';
    document.getElementById('bidResponse').style.display = 'none';
    
    try {
        const cookiesResponse = await fetch("upwork/cookies.php", {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        });

        // Extract cookies from the response
        const cookiesData = await cookiesResponse.json();
        const cookies = cookiesData.cookies;

        // Step 2: Retrieve other required parameters
        const xsrfToken = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')[1];
        const jobReference = selectedJob.id;
        const cipher = selectedJob.jobTile.job.ciphertext;
        const coverLetter = generatedMessage;
        const authToken = upworkCreds.access_token || upworkCreds.token;
        const user_uid = upworkCreds.user_uid;
        const oDeskUserID = upworkCreds.console_user;
        const pricepercentage = upworkSettings.price_percentage || 90;
        
        // Calculate price correctly
        let price = 0;
        if (selectedJob.jobTile.job.jobType === 'HOURLY') {
            price = parseInt(bidPrice); // Use the bid price directly for hourly
        } else if (selectedJob.jobTile.job.jobType === 'FIXED') {
            const fixedAmount = selectedJob.jobTile.job.fixedPriceAmount?.amount || 0;
            price = Math.round(fixedAmount * pricepercentage / 100 / 5) * 5;
        }
        
        // Step 3: Prepare the request body including the cookies
        const requestBody = {
            token: authToken,
            cipher: cipher,
            csrf: xsrfToken,
            jobref: jobReference,
            chargedAmount: price,
            cover: coverLetter,
            uid: user_uid,
            odesk: oDeskUserID,
            cookies: cookies,
        };

        // Step 4: Make the POST request to your backend
        const response = await fetch("https://autobid.online/upwork/", {
            body: JSON.stringify(requestBody),
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Step 5: Handle the response
        const result = await response.json();
        if (result.error) {
            document.getElementById('bidResponse').innerHTML = `<div class="alert alert-danger">Error: ${result.error.message}</div>`;
            document.getElementById('bidResponse').style.display = 'block';
        } else {
            if (result.pending === false) {
                // Step 6: Save bid to database
                await saveBidToDatabase(result.newUID, cipher, selectedJob, coverLetter, price);
                
                document.getElementById('bidResponse').innerHTML = '<div class="alert alert-success">Bid submitted successfully!</div>';
                document.getElementById('bidResponse').style.display = 'block';
            } else {
                document.getElementById('bidResponse').innerHTML = '<div class="alert alert-success">Bid submitted successfully!</div>';
                document.getElementById('bidResponse').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error submitting bid:', error);
        document.getElementById('bidResponse').innerHTML = '<div class="alert alert-danger">An error occurred while submitting the bid.</div>';
        document.getElementById('bidResponse').style.display = 'block';
    } finally {
        document.getElementById('submitBidBtn').disabled = false;
        document.getElementById('submitBidText').textContent = 'Submit Bid';
    }
}

async function saveBidToDatabase(bidId, cipher, job, coverLetter, price) {
    try {
        // Format job price based on job type
        let jprice = '';
        if (job.jobTile?.job?.jobType === 'FIXED') {
            const fixedAmount = job.jobTile.job.fixedPriceAmount?.amount || '0';
            jprice = `Fixed: $${fixedAmount}`;
        } else if (job.jobTile?.job?.jobType === 'HOURLY') {
            const minRate = job.jobTile.job.hourlyBudgetMin || '0';
            const maxRate = job.jobTile.job.hourlyBudgetMax || '0';
            jprice = `Hourly: $${minRate}/hr - $${maxRate}/hr`;
        }

        // Extract skills as array of pretty names
        const skills = job.ontologySkills?.map(skill => skill.prettyName) || [];

        // Get short description (first 500 characters)
        const shortDescription = job.description?.substring(0, 500) || '';

        const bidData = {
            bid: bidId,
            jcipher: cipher,
            jtitle: job.title,
            cover_letter: coverLetter,
            price: price,
            jprice: jprice,
            client: job.upworkHistoryData?.client || {},
            jobType: job.jobTile?.job?.jobType || '',
            description: shortDescription,
            skills: skills
        };

        // Send to PHP endpoint to save in database
        const response = await fetch('save-bid.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bidData)
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            console.log('Bid saved to database successfully');
        } else {
            console.error('Failed to save bid to database:', result.message);
        }
    } catch (error) {
        console.error('Error saving bid to database:', error);
    }
}

// Utility functions
function getTimeAgo(createTime) {
    if (!createTime) return 'Time unknown';
    
    const currentTime = Date.now();
    const timeDiff = currentTime - new Date(createTime).getTime();
    
    if (timeDiff < 60000) {
        return `Posted ${Math.floor(timeDiff / 1000)} seconds ago`;
    } else if (timeDiff < 3600000) {
        return `Posted ${Math.floor(timeDiff / 60000)} minutes ago`;
    } else if (timeDiff < 86400000) {
        return `Posted ${Math.floor(timeDiff / 3600000)} hours ago`;
    } else {
        return `Posted ${Math.floor(timeDiff / 86400000)} days ago`;
    }
}

function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (rating >= i) {
            stars += '<i class="ri-star-fill text-warning" style="font-size: 16px;"></i>';
        } else if (rating >= i - 0.5) {
            stars += '<i class="ri-star-half-fill text-warning" style="font-size: 16px;"></i>';
        } else {
            stars += '<i class="ri-star-fill text-muted" style="font-size: 16px;"></i>';
        }
    }
    return stars;
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-top-border alert-dismissible fade show`;
    alertDiv.innerHTML = `
        <i class="ri-${type === 'warning' ? 'error-warning-line' : 'information-line'} me-3 align-middle fs-16 text-${type}"></i>
        <strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong> - ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.card-body');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}
