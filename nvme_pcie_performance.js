var IO_Size_B = 131072;
var IOs_Per_Interrupt = 1;
var IOs_Per_CQ_DB_write = 1;
var MMIO_Address_Size_B = 4;
var DMA_Address_Size_B = 8;
var MSI_Address_Size_B = 4;
var MPS_B = 256;
var MRRS_B = 4096;
var ECRC = 0;
var PRP_List_Size_B = 4096;
var DS_Mem_Write_B = 20;
var US_Mem_Write_MSI_B = 20;
var US_Mem_Write_DMA_B = 24;
var US_Mem_Read_DMA_B = 24;
var DS_Mem_Cpl_B = 20;
var Update_FC_DLLP_B = 8;
var ACK_NAK_DLLP = 8;
var Update_FC_Types = 3;
var Total_Update_FC_B = 24;
var PCIe_Generation = 3;
var Base_Speeds_MB_per_s = [250,500,984.6,1969]; //includes encoding 8/10 for 1 and 2 and 128/130 for 3 and 4
var PRP_List_Required_B = 8192;
var SKP_SNRS = new Boolean();

function calculate(generation, skps, ioSize, mps) {
  var iopsBWPerLane = new Map();
  PCIe_Generation = generation;
  SKP_SNRS = false;
  if (skps == "SNRS") {
    SKP_SNRS = true;
  }
  IO_Size_B = ioSize;
  console.log("iosize B: " + IO_Size_B);
  MPS_B = mps;

  var base_speed = Base_Speeds_MB_per_s[PCIe_Generation - 1];
  var read_size = calculate_read_size();
  var write_size = calculate_write_size();
  if (SKP_SNRS) {
    base_speed = base_speed * 0.9973;
  }else{ //then SRIS
	base_speed = base_speed * 0.974;
  }

  var read_iops_per_lane = base_speed * 1000000 / read_size;
  iopsBWPerLane.set("read_mps",read_iops_per_lane * IO_Size_B/1000000);
  iopsBWPerLane.set("read_iops",read_iops_per_lane);

  var write_iops_per_lane = base_speed * 1000000 / write_size;
  iopsBWPerLane.set("write_mps", write_iops_per_lane * IO_Size_B/1000000);
  iopsBWPerLane.set("write_iops",write_iops_per_lane);

  return iopsBWPerLane;
}

function calculate_read_size() {
	//upstream only
	var overhead_payload_b = 0;
	var header_b = 0;
	var payload_b = 0;

	header_b += ACK_NAK_DLLP; //MMIO Write Submission Q Doorbell 

	header_b += US_Mem_Read_DMA_B; //DMA Submssion Q Event Request
	header_b += ACK_NAK_DLLP; //DMA Submission Q Event Completion

	if (self.IO_Size_B > PRP_List_Required_B) {
		overhead_payload_b += US_Mem_Read_DMA_B; //DMA PRP request
		header_b += 16*ACK_NAK_DLLP; //DMA PRP completions 
	}
	header_b += IO_Size_B/MPS_B*US_Mem_Write_DMA_B; //headers for data writes
	payload_b += IO_Size_B; //data payload

	header_b += US_Mem_Write_DMA_B; //DMA Completion Q Event write header
	overhead_payload_b += 16; //DMA Completion Q Event write payload

	header_b += US_Mem_Write_MSI_B; //MSI write header
	overhead_payload_b += 4; //MSI write payload

	header_b += ACK_NAK_DLLP; //MMIO Write Completion Q DB
    
    var total_b = header_b + overhead_payload_b + payload_b;
    
    console.log("reads");
    console.log("total B: " + total_b);
    console.log("header B: " + header_b);
    console.log("overhead payload B: " + overhead_payload_b);
    console.log("payload B: " + payload_b);
    
	return total_b;
}

function calculate_write_size() {
	//downstream only
	var overhead_payload_b = 0;
	var header_b = 0;
	var payload_b = 0;

	header_b += DS_Mem_Write_B; //MMIO Write Submission Q Doorbell
	overhead_payload_b += 4;

	header_b += ACK_NAK_DLLP; //DMA Submssion Q Event Request

	header_b += DS_Mem_Cpl_B; //DMA Submission Q Event Completion
	overhead_payload_b += 64;

	if (IO_Size_B > PRP_List_Required_B) {
		header_b += ACK_NAK_DLLP; //DMA PRP request
		header_b += PRP_List_Size_B/MPS_B*DS_Mem_Cpl_B; //DMA PRP completions
		overhead_payload_b += PRP_List_Size_B;
	}
	
	header_b += IO_Size_B/MRRS_B*ACK_NAK_DLLP; //DMA Data Requests

	header_b += IO_Size_B/MPS_B*DS_Mem_Cpl_B; //headers for DMA Data Completions
	payload_b += IO_Size_B //data payload

	header_b += ACK_NAK_DLLP; //DMA Completion Q Event write header

	header_b += ACK_NAK_DLLP; //MSI write

	header_b += DS_Mem_Write_B; //MMIO Write Completion Q DB
	overhead_payload_b += 4; //MMIO Write Completion Q DB

    var total_b = header_b + overhead_payload_b + payload_b;

    console.log("writes");
    console.log("total B: " + total_b);
    console.log("header B: " + header_b);
    console.log("overhead payload B: " + overhead_payload_b);
    console.log("payload B: " + payload_b);
    
	return total_b;
}