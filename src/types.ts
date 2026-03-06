export interface WASession {
	id: string; // The session_id
	project_name: string;
	allowed_numbers: string[]; // Decoded JSON
	webhook_url: string | null;
	created_at: string;
}

export type Direction = 'incoming' | 'outgoing';

export interface WAMessage {
	id?: number;
	session_id: string;
	message_id: string;
	sender: string;
	recipient: string;
	direction: Direction;
	content_type: string;
	body: string | null;
	media_url: string | null;
	timestamp: string;
	is_read: boolean;
	metadata: any | null; // Decoded JSON
}
