(() => {
    'use strict';

    const APPROVAL_TASK = 'UserTask_Approve';
    const POLL_INTERVAL = 2500;
    const MAX_POLL_ERRORS = 4;

    window.aiAgentProcess = {
        APPROVAL_TASK,
        async waitForApprovalTask(processInstanceKey, onStatus, signal) {
            let errors = 0;
            while (!signal?.aborted) {
                try {
                    const status = await window.aiAgentApi.getProcessStatus(processInstanceKey);
                    errors = 0;
                    onStatus(status);
                    if (status.currentTask?.taskDefinitionId === APPROVAL_TASK ||
                        ['COMPLETED', 'FAILED', 'CANCELED'].includes(status.status)) return status;
                } catch (error) {
                    errors += 1;
                    if (errors >= MAX_POLL_ERRORS) throw error;
                    onStatus({pollingError: error});
                }
                await new Promise(resolve => window.setTimeout(resolve, POLL_INTERVAL));
            }
            return null;
        }
    };
})();
