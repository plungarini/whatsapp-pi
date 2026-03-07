export interface WASession {
	id: string;
	project_name: string;
	allowed_numbers: string[];
	webhook_url?: string;
	created_at: string;
}

export interface WAMessage {
	session_id: string;
	message_id: string;
	sender: string;
	recipient: string;
	direction: 'incoming' | 'outgoing';
	content_type: string;
	body?: string;
	media_url?: string;
	timestamp: string;
	is_read: boolean;
	metadata?: any;
}
